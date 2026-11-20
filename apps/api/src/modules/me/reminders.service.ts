import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { sendSmtpMail } from './smtp-mailer';

const SCAN_INTERVAL_MS = 5 * 60 * 1000;
const REMIND_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;
const OVERDUE_REPEAT_DAYS = 7;

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.scanSafely(), SCAN_INTERVAL_MS);
    this.timer.unref();
    void this.scanSafely();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async list(accountId: string, page: number, pageSize: number) {
    const where = { accountId };
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, subject: true, body: true, createdAt: true, sentAt: true, readAt: true },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { accountId, readAt: null } }),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), sentAt: item.sentAt?.toISOString() ?? null, readAt: item.readAt?.toISOString() ?? null })),
      total, page, pageSize, unreadCount,
    };
  }

  async markRead(accountId: string, ids: string[]): Promise<void> {
    await this.prisma.notification.updateMany({ where: { accountId, id: { in: ids }, readAt: null }, data: { readAt: this.clock.now() } });
  }

  private async scanSafely(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scheduleDueReminders();
      await this.processPendingEmails();
    } catch (error) {
      this.logger.error('Không tạo được nhắc hạn từ các khoản mượn.', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async scheduleDueReminders(): Promise<void> {
    const now = this.clock.now();
    const upperBound = new Date(now.getTime() + REMIND_BEFORE_MS);
    let cursor: { id: string } | undefined;
    while (true) {
      const loans = await this.prisma.loan.findMany({
        where: { status: 'active', dueAt: { lte: upperBound } },
        include: { borrower: { include: { profile: true } }, copy: { include: { edition: { include: { work: true } } } } },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 500,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });
      if (!loans.length) break;

      for (const loan of loans) {
      const isOverdue = loan.dueAt.getTime() < now.getTime();
      const reminderKind = isOverdue ? 'overdue' : 'due-soon';
      const cycle = isOverdue
        ? Math.floor((now.getTime() - loan.dueAt.getTime()) / (OVERDUE_REPEAT_DAYS * 24 * 60 * 60 * 1000))
        : loan.dueAt.toISOString().slice(0, 10);
      const dueDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(loan.dueAt);
      const title = loan.copy.edition.work.title;
      const subject = isOverdue ? 'Tài liệu đã quá hạn' : 'Nhắc hạn trả tài liệu';
      const body = isOverdue
        ? `Tài liệu “${title}” đã quá hạn từ ${dueDate}. Vui lòng liên hệ thư viện để xử lý.`
        : `Tài liệu “${title}” đến hạn trả vào ${dueDate}.`;
      const dedupeKey = `${loan.id}:${reminderKind}:${cycle}`;
      try {
        await this.prisma.notification.create({
          data: {
            accountId: loan.borrowerId, loanId: loan.id, dedupeKey, subject, body,
            recipientEmail: loan.borrower.profile?.reminderEmailEnabled === false
              ? null
              : loan.borrower.profile?.contactEmail ?? loan.borrower.email,
            status: loan.borrower.profile?.reminderEmailEnabled === false ? 'skipped' : 'pending',
            sentAt: loan.borrower.profile?.reminderEmailEnabled === false ? now : null,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
      }
      cursor = { id: loans[loans.length - 1]!.id };
      if (loans.length < 500) break;
    }
  }

  private async processPendingEmails(): Promise<void> {
    const now = this.clock.now();
    const pending = await this.prisma.notification.findMany({
      where: { status: { in: ['pending', 'processing'] }, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: 'asc' }, take: 20,
    });

    for (const notification of pending) {
      const claimed = await this.prisma.notification.updateMany({
        where: { id: notification.id, status: notification.status, nextAttemptAt: { lte: now } },
        data: { status: 'processing', nextAttemptAt: new Date(now.getTime() + 5 * 60 * 1000), attemptCount: { increment: 1 } },
      });
      if (claimed.count === 0) continue;
      try {
        if (!notification.recipientEmail) throw new Error('Không có địa chỉ email nhận nhắc hạn.');
        const current = await this.prisma.notification.findUnique({
          where: { id: notification.id }, include: { loan: true, account: { include: { profile: true } } },
        });
        if (!current) continue;
        const isOverdueReminder = current.dedupeKey.includes(':overdue:');
        const dueAt = current.loan.dueAt.getTime();
        const currentCycle = isOverdueReminder
          ? String(Math.floor((now.getTime() - dueAt) / (OVERDUE_REPEAT_DAYS * 24 * 60 * 60 * 1000)))
          : current.loan.dueAt.toISOString().slice(0, 10);
        const queuedCycle = current.dedupeKey.split(':').at(-1);
        const stillRelevant = current.loan.status === 'active' && (isOverdueReminder
          ? dueAt < now.getTime()
          : dueAt >= now.getTime() && dueAt <= now.getTime() + REMIND_BEFORE_MS) && queuedCycle === currentCycle;
        if (!stillRelevant || current.account.profile?.reminderEmailEnabled === false) {
          await this.prisma.notification.update({ where: { id: current.id }, data: { status: 'skipped', sentAt: now } });
          continue;
        }
        const recipientEmail = current.account.profile?.contactEmail ?? current.account.email;
        if (!recipientEmail) {
          await this.prisma.notification.update({ where: { id: current.id }, data: { status: 'skipped', sentAt: now } });
          continue;
        }
        await sendSmtpMail({ to: recipientEmail, subject: current.subject, text: current.body });
        await this.prisma.notification.update({
          where: { id: notification.id }, data: { status: 'sent', sentAt: this.clock.now(), lastError: null },
        });
      } catch (error) {
        const attemptCount = notification.attemptCount + 1;
        const retryDelaysMinutes = [1, 5, 15, 60];
        const retryDelay = retryDelaysMinutes[Math.min(attemptCount - 1, retryDelaysMinutes.length - 1)] ?? 60;
        const errorMessage = error instanceof Error ? error.message.slice(0, 500) : 'SMTP send failed';
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: attemptCount >= 5 ? 'failed' : 'pending',
            nextAttemptAt: new Date(this.clock.now().getTime() + retryDelay * 60 * 1000),
            lastError: errorMessage,
          },
        });
        this.logger.warn(`Không gửi được email nhắc hạn ${notification.id} (lần ${attemptCount}).`);
      }
    }
  }
}
