import { Injectable } from '@nestjs/common';
import { permissionsFor, type WorkspaceTaskDto } from '@thu-vien/shared';
import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async tasks(accountId: string): Promise<WorkspaceTaskDto[]> {
    const roles = await this.prisma.accountRole.findMany({ where: { accountId } });
    const permissions = permissionsFor(roles.map(entry => entry.role));
    const tasks: Array<Promise<WorkspaceTaskDto>> = [];
    const add = (label: string, to: string, count: Promise<number>) => {
      tasks.push(count.then(value => ({ label, to, count: value })));
    };
    if (permissions.has('circulation:manage')) {
      add('Khoản mượn quá hạn', '/circulation/loans?overdue=true&status=active', this.prisma.loan.count({ where: { status: 'active', dueAt: { lt: this.clock.now() } } }));
    }
    if (permissions.has('reservations:read')) {
      add('Đặt trước chờ nhận', '/circulation/reservations?status=ready_for_pickup', this.prisma.reservation.count({ where: { status: 'ready_for_pickup' } }));
    }
    if (permissions.has('catalog:write')) {
      add('Bản ghi cần sửa sau từ chối', '/catalog/records?status=draft&rejected=true', this.prisma.work.count({ where: { status: 'draft', rejectReason: { not: null } } }));
    }
    if (permissions.has('catalog:approve')) {
      add('Tài liệu đang chờ duyệt', '/catalog/records?status=pending', this.prisma.work.count({ where: { status: 'pending' } }));
    }
    if (permissions.has('fines:read')) {
      add('Khoản phạt chưa thanh toán', '/circulation/fines?status=unpaid', this.prisma.fine.count({ where: { status: 'unpaid' } }));
    }
    if (permissions.has('incidents:read')) {
      add('Sự cố mới cần tiếp nhận', '/incidents?status=new', this.prisma.incident.count({ where: { status: 'new' } }));
    }
    return Promise.all(tasks);
  }
}
