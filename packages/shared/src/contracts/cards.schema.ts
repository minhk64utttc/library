import { z } from 'zod';

import { pageQuerySchema } from './pagination.schema';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD').refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Ngày không hợp lệ');

export const libraryCardCreateSchema = z.object({
  accountId: z.string().min(1).max(100),
  cardNumber: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Mã thẻ chỉ gồm chữ, số và dấu gạch ngang').transform((value) => value.toUpperCase()),
  expiresOn: dateOnlySchema,
});

export type LibraryCardCreate = z.infer<typeof libraryCardCreateSchema>;

export const libraryCardRenewSchema = z.object({
  expiresOn: dateOnlySchema,
  reason: z.string().trim().max(500).optional(),
});

export type LibraryCardRenew = z.infer<typeof libraryCardRenewSchema>;

export const libraryCardActionSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export type LibraryCardAction = z.infer<typeof libraryCardActionSchema>;

export const libraryCardListQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'locked', 'expired']).optional(),
});

export type LibraryCardListQuery = z.infer<typeof libraryCardListQuerySchema>;

export type LibraryCardStatus = 'active' | 'locked' | 'expired';

export interface LibraryCardEventDto {
  id: string;
  actorName: string;
  action: string;
  reason: string | null;
  previousExpiresOn: string | null;
  newExpiresOn: string | null;
  createdAt: string;
}

export interface LibraryCardDto {
  id: string;
  accountId: string;
  borrowerName: string;
  borrowerEmail: string;
  cardNumber: string;
  status: LibraryCardStatus;
  expiresOn: string;
  lockedAt: string | null;
  lockReason: string | null;
  events: LibraryCardEventDto[];
}

export interface LibraryCardBorrowerDto {
  id: string;
  email: string;
  fullName: string;
}
