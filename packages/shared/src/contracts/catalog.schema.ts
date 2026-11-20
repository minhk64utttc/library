import { z } from 'zod';
import { pageQuerySchema } from './pagination.schema';
import { RECORD_STATUSES } from '../enums';

export const recordListQuerySchema = pageQuerySchema.extend({
  status: z.enum(RECORD_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  rejected: z.enum(['true', 'false']).optional(),
  sort: z.enum(['updated', 'title', 'oldest']).default('updated'),
});
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;

export const publisherInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional(),
});

export type PublisherInput = z.infer<typeof publisherInputSchema>;

export const publisherUpdateSchema = publisherInputSchema.partial();

export type PublisherUpdate = z.infer<typeof publisherUpdateSchema>;

export const editionInputSchema = z.object({
  publisherId: z.string().min(1).optional(),
  isbn: z.string().max(20).optional(),
  language: z.string().max(50).optional(),
  publishYear: z.coerce.number().int().min(0).max(3000).optional(),
  editionNo: z.coerce.number().int().min(1).optional(),
  callNumber: z.string().trim().min(1).max(100).optional(),
});

export type EditionInput = z.infer<typeof editionInputSchema>;

export const callNumberUpdateSchema = z.object({
  callNumber: z.string().trim().min(1).max(100),
});

export type CallNumberUpdate = z.infer<typeof callNumberUpdateSchema>;

export const recordInputSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  classification: z.string().max(100).optional(),
  editions: z.array(editionInputSchema).default([]),
});

export type RecordInput = z.infer<typeof recordInputSchema>;

export const recordUpdateSchema = recordInputSchema.partial();

export type RecordUpdate = z.infer<typeof recordUpdateSchema>;

export const recordRejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type RecordReject = z.infer<typeof recordRejectSchema>;

export interface PublisherDto {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

export interface EditionDto {
  id: string;
  publisherId: string | null;
  publisherName: string | null;
  isbn: string | null;
  language: string | null;
  publishYear: number | null;
  editionNo: number | null;
  callNumber: string | null;
}

export interface CatalogRecordDto {
  id: string;
  title: string;
  author: string | null;
  subject: string | null;
  classification: string | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  editions: EditionDto[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
