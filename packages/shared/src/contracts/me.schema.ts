import { z } from 'zod';

import type { Role } from '../auth/roles';

export const updateMyProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(20).optional(),
  contactEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  reminderEmailEnabled: z.boolean().optional(),
});

export type UpdateMyProfile = z.infer<typeof updateMyProfileSchema>;

export interface WorkspaceTaskDto {
  label: string;
  to: string;
  count: number;
}

export interface MyCardActivityDto {
  activeLoanCount: number;
  events: Array<{ id: string; action: string; reason: string | null; createdAt: string; newExpiresOn: string | null }>;
}

export interface MyProfileDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  contactEmail: string | null;
  reminderEmailEnabled: boolean;
  photoUrl: string | null;
  libraryCard: {
    cardNumber: string;
    status: 'active' | 'locked' | 'expired';
    expiresOn: string;
  } | null;
  roles: Role[];
  status: string;
  mustChangePassword: boolean;
}
