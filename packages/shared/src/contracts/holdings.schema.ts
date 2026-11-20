import { z } from 'zod';

import { COPY_STATUSES } from '../enums';

export const copyStatusSchema = z.enum(COPY_STATUSES);

export const locationInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});

export type LocationInput = z.infer<typeof locationInputSchema>;

export const copyBulkCreateSchema = z.object({
  editionId: z.string().min(1),
  count: z.coerce.number().int().min(1).max(50),
  locationId: z.string().min(1).optional(),
});

export type CopyBulkCreate = z.infer<typeof copyBulkCreateSchema>;

export const copyUpdateSchema = z.object({
  status: copyStatusSchema.optional(),
  locationId: z.string().min(1).nullable().optional(),
});

export type CopyUpdate = z.infer<typeof copyUpdateSchema>;

export interface LocationDto {
  id: string;
  code: string;
  name: string;
}

export interface CopyDto {
  id: string;
  code: string;
  editionId: string;
  locationId: string | null;
  locationName?: string | null;
  status: string;
  workTitle: string | null;
}
