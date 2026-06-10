import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'user', 'guest']);
export const OrderStatusSchema = z.enum(['pending', 'paid', 'shipped', 'cancelled']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: RoleSchema,
  createdAt: z.string().datetime(),
  metadata: z.object({
    lastLogin: z.string().datetime().nullable(),
    loginCount: z.number().int().nonnegative(),
  }),
});

export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const UserListSchema = z.object({
  data: z.array(UserSchema),
  pagination: PaginationSchema,
});

export const CreateUserBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(72),
  role: RoleSchema.optional(),
});

export const UpdateUserBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: RoleSchema.optional(),
});

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const LoginResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.string(),
  user: UserSchema,
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  description: z.string(),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: OrderStatusSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
  items: z.array(OrderItemSchema),
});

export const OrderListSchema = z.object({
  data: z.array(OrderSchema),
  pagination: PaginationSchema,
});

export const CreateOrderItemInputSchema = z.object({
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

export const CreateOrderBodySchema = z.object({
  userId: z.string().uuid(),
  currency: z.string().length(3).default('BRL'),
  items: z.array(CreateOrderItemInputSchema).min(1),
});

export const UpdateOrderStatusBodySchema = z.object({
  status: OrderStatusSchema,
});

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().optional(),
  role: RoleSchema.optional(),
  status: OrderStatusSchema.optional(),
});

export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const HealthSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number().nonnegative(),
  version: z.string(),
});

export type UserDto = z.infer<typeof UserSchema>;
export type OrderDto = z.infer<typeof OrderSchema>;
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;
export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusBodySchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
