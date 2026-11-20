import type { CopyStatus } from '@thu-vien/shared';

const LABELS: Record<CopyStatus, string> = {
  processing: 'Đang xử lý',
  available: 'Sẵn sàng',
  on_loan: 'Đang mượn',
  reserved: 'Giữ chỗ',
  damaged: 'Hỏng',
  lost: 'Mất',
  pending_search: 'Chờ tra soát',
  withdrawn: 'Đã rút',
};

export const COPY_STATUS_OPTIONS: CopyStatus[] = [
  'processing',
  'available',
  'on_loan',
  'reserved',
  'damaged',
  'lost',
  'pending_search',
  'withdrawn',
];

export function copyStatusLabel(status: string): string {
  return LABELS[status as CopyStatus] ?? status;
}
