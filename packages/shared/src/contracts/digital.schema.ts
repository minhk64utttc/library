import { z } from 'zod';

import { pageQuerySchema } from './pagination.schema';

export const DIGITAL_STATUSES = ['new_submission', 'under_review', 'need_more_info', 'accepted', 'published'] as const;
export const DIGITAL_ACCESS_LEVELS = ['public', 'members_only', 'campus_only', 'restricted'] as const;
export type DigitalAccessLevel = (typeof DIGITAL_ACCESS_LEVELS)[number];

export const digitalSubmissionCreateSchema = z.object({
  title: z.string().trim().min(2).max(300),
  abstract: z.string().trim().min(20).max(10000),
  author: z.string().trim().min(2).max(300),
  department: z.string().trim().max(200).optional(),
  publishedYear: z.coerce.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
  license: z.string().trim().min(2).max(300),
  rightsConfirmed: z.literal(true),
});
export type DigitalSubmissionCreate = z.infer<typeof digitalSubmissionCreateSchema>;

export const digitalReviewNoteSchema = z.object({ note: z.string().trim().min(5).max(2000) });
export const digitalPublishSchema = z.object({
  accessLevel: z.enum(DIGITAL_ACCESS_LEVELS),
  note: z.string().trim().max(2000).optional(),
});
export const digitalListQuerySchema = pageQuerySchema.extend({
  status: z.enum(DIGITAL_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
});

export type DigitalReviewNote = z.infer<typeof digitalReviewNoteSchema>;
export type DigitalPublish = z.infer<typeof digitalPublishSchema>;
export type DigitalListQuery = z.infer<typeof digitalListQuerySchema>;

export interface DigitalSubmissionDto {
  id: string;
  submissionCode: string;
  title: string;
  abstract: string;
  author: string;
  department: string | null;
  publishedYear: number | null;
  license: string;
  rightsConfirmed: boolean;
  status: (typeof DIGITAL_STATUSES)[number];
  accessLevel: DigitalAccessLevel | null;
  reviewNote: string | null;
  publicationNote: string | null;
  submittedAt: string;
  publishedAt: string | null;
  submitterId: string;
  submitterName: string;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number; checksumSha256: string; versionNumber: number } | null;
}

export interface DigitalSubmissionEventDto {
  id: string;
  action: string;
  note: string | null;
  actorName: string;
  createdAt: string;
}
