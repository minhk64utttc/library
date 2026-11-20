export const LOAN_STATUSES = ['active', 'returned', 'lost'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const COPY_STATUSES = [
  'processing',
  'available',
  'on_loan',
  'reserved',
  'damaged',
  'lost',
  'pending_search',
  'withdrawn',
] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export const RECORD_STATUSES = ['draft', 'pending', 'approved', 'published', 'withdrawn'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RESERVATION_STATUSES = [
  'waiting',
  'ready_for_pickup',
  'fulfilled',
  'cancelled',
  'expired',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const FINE_STATUSES = ['unpaid', 'paid', 'waived'] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];
