import { z } from 'zod';

import { ROLES, type Role } from '../auth/roles';
import { pageQuerySchema } from './pagination.schema';

const roleSchema = z.enum(ROLES);

export const accountCreateSchema = z.object({
  email: z.string().email().max(200),
  fullName: z.string().trim().min(1).max(200),
  readerGroup: z.enum(['student', 'lecturer', 'staff', 'other']).default('student'),
  password: z.string().min(8).max(200),
  roles: z.array(roleSchema).min(1),
  status: z.enum(['active', 'disabled']).default('active'),
  mustChangePassword: z.boolean().default(false),
});

export type AccountCreate = z.infer<typeof accountCreateSchema>;

export const accountUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  readerGroup: z.enum(['student', 'lecturer', 'staff', 'other']).optional(),
  roles: z.array(roleSchema).min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  mustChangePassword: z.boolean().optional(),
});

export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

export const accountResetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

export type AccountResetPassword = z.infer<typeof accountResetPasswordSchema>;

export const accountListQuerySchema = pageQuerySchema.extend({
  q: z.string().max(200).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  role: roleSchema.optional(),
});

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

export interface AccountDto {
  id: string;
  email: string;
  fullName: string;
  readerGroup: 'student' | 'lecturer' | 'staff' | 'other';
  roles: Role[];
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
}
