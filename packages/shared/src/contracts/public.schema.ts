import { z } from 'zod';

export const publicSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  subject: z.string().trim().max(200).optional(),
  author: z.string().trim().max(200).optional(),
  language: z.string().trim().max(50).optional(),
  publisher: z.string().trim().max(200).optional(),
  availableOnly: z.enum(['true', 'false']).transform(value => value === 'true').or(z.boolean()).optional(),
  yearFrom: z.coerce.number().int().min(0).max(3000).optional(),
  yearTo: z.coerce.number().int().min(0).max(3000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['newest', 'title', 'relevance', 'year', 'available']).default('relevance'),
}).refine(value => value.yearFrom === undefined || value.yearTo === undefined || value.yearFrom <= value.yearTo, {
  message: 'Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc', path: ['yearTo'],
});

export type PublicSearchQuery = z.infer<typeof publicSearchQuerySchema>;

export type CopyAvailability = 'available' | 'on_loan' | 'reserved' | 'other';

export interface PublicCopyDto {
  code: string;
  status: CopyAvailability;
  locationName: string | null;
}

export interface PublicEditionDto {
  id: string;
  publisherName: string | null;
  isbn: string | null;
  language: string | null;
  publishYear: number | null;
  editionNo: number | null;
  callNumber: string | null;
  availableCount: number;
  totalCount: number;
  copies: PublicCopyDto[];
}

export interface PublicFacetOption { value: string; count: number }
export interface PublicSearchFacets {
  subjects: PublicFacetOption[];
  authors: PublicFacetOption[];
  languages: PublicFacetOption[];
  publishers: PublicFacetOption[];
}

export interface PublicRecordDto {
  id: string;
  title: string;
  author: string | null;
  subject: string | null;
  classification: string | null;
  editions: PublicEditionDto[];
}
