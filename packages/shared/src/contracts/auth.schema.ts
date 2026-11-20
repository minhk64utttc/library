import { z } from 'zod';

import { ROLES } from '../auth/roles';

export const roleSchema = z.enum(ROLES);

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const accountSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  roles: z.array(roleSchema),
  mustChangePassword: z.boolean(),
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;
