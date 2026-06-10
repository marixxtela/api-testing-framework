import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'user', 'guest']);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: roleSchema,
  createdAt: z.string().datetime(),
  metadata: z.object({
    lastLogin: z.string().datetime().nullable(),
    loginCount: z.number().int().nonnegative(),
  }),
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const userListSchema = z.object({
  data: z.array(userSchema),
  pagination: paginationSchema,
});

export const loginResponseSchema = z.object({
  token: z.string().min(20),
  expiresIn: z.string(),
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;
export type UserList = z.infer<typeof userListSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type Role = z.infer<typeof roleSchema>;
