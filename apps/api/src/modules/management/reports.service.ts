import { Injectable } from '@nestjs/common';
import type { ReportQuery, ReportSummaryDto } from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';

function bangkokStart(date: string): Date {
  return new Date(`${date}T00:00:00.000+07:00`);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async summary(query: ReportQuery): Promise<ReportSummaryDto> {
    const from = bangkokStart(query.from);
    const end = bangkokStart(query.to);
    const toExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const now = this.clock.now();

    const [totalWorks, activeLoans, readerCount, borrowedCount, returnedCount, overdueCount, finesCreated, collections, waivers, copies, popularWorks, activityRows] = await Promise.all([
      this.prisma.work.count(),
      this.prisma.loan.count({ where: { status: 'active' } }),
      this.prisma.account.count({ where: { roles: { some: { role: 'reader' } } } }),
      this.prisma.loan.count({ where: { borrowedAt: { gte: from, lt: toExclusive } } }),
      this.prisma.loan.count({ where: { returnedAt: { gte: from, lt: toExclusive } } }),
      this.prisma.loan.count({ where: { status: 'active', dueAt: { lt: now } } }),
      this.prisma.fine.aggregate({ where: { createdAt: { gte: from, lt: toExclusive } }, _sum: { amount: true } }),
      this.prisma.finePayment.aggregate({ where: { receivedAt: { gte: from, lt: toExclusive } }, _sum: { amount: true } }),
      this.prisma.fineWaiverRequest.aggregate({ where: { status: 'approved', decidedAt: { gte: from, lt: toExclusive } }, _sum: { approvedAmount: true } }),
      this.prisma.copy.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.$queryRaw<Array<{ title: string; borrowCount: number }>>`
        SELECT work."title", COUNT(loan."id")::int AS "borrowCount"
        FROM "Loan" AS loan
        JOIN "Copy" AS copy ON copy."id" = loan."copyId"
        JOIN "Edition" AS edition ON edition."id" = copy."editionId"
        JOIN "Work" AS work ON work."id" = edition."workId"
        WHERE loan."borrowedAt" >= ${from} AND loan."borrowedAt" < ${toExclusive}
        GROUP BY work."id", work."title"
        ORDER BY COUNT(loan."id") DESC, work."title" ASC
        LIMIT 10
      `,
      this.prisma.$queryRaw<Array<{ month: number; borrowed: number; returned: number }>>`
        SELECT activity.month::int AS month, SUM(activity.borrowed)::int AS borrowed, SUM(activity.returned)::int AS returned
        FROM (
          SELECT EXTRACT(MONTH FROM (loan."borrowedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS month, COUNT(*) AS borrowed, 0 AS returned
          FROM "Loan" AS loan WHERE loan."borrowedAt" >= ${from} AND loan."borrowedAt" < ${toExclusive}
          GROUP BY month
          UNION ALL
          SELECT EXTRACT(MONTH FROM (loan."returnedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS month, 0 AS borrowed, COUNT(*) AS returned
          FROM "Loan" AS loan WHERE loan."returnedAt" >= ${from} AND loan."returnedAt" < ${toExclusive}
          GROUP BY month
        ) AS activity GROUP BY activity.month ORDER BY activity.month
      `,
    ]);

    const activityByMonth = new Map(activityRows.map((row) => [row.month, row]));

    return {
      from: query.from,
      to: query.to,
      totalWorks,
      activeLoans,
      readerCount,
      borrowedCount,
      returnedCount,
      overdueCount,
      finesCreated: finesCreated._sum.amount ?? 0,
      finesCollected: collections._sum.amount ?? 0,
      finesWaived: waivers._sum.approvedAmount ?? 0,
      copyStatus: copies.map((row) => ({ status: row.status, count: row._count._all })),
      popularWorks,
      monthlyActivity: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const row = activityByMonth.get(month);
        return { month, borrowed: row?.borrowed ?? 0, returned: row?.returned ?? 0 };
      }),
    };
  }
}
