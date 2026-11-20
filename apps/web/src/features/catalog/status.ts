import type { RecordStatus } from '@thu-vien/shared';

const LABELS: Record<RecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  published: 'Đã công bố',
  withdrawn: 'Đã rút',
};

export const RECORD_STATUS_OPTIONS: RecordStatus[] = [
  'draft',
  'pending',
  'approved',
  'published',
  'withdrawn',
];

export function statusLabel(status: string): string {
  return LABELS[status as RecordStatus] ?? status;
}
