import { z } from 'zod';

export const profileContactInputSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1).max(20),
});

export type ProfileContactInput = z.infer<typeof profileContactInputSchema>;
