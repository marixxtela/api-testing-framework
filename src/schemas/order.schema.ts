import { z } from 'zod';
import { paginationSchema } from './user.schema.js';

export const orderStatusSchema = z.enum(['pending', 'paid', 'shipped', 'cancelled']);

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: orderStatusSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
  items: z.array(orderItemSchema).min(1),
});

export const orderListSchema = z.object({
  data: z.array(orderSchema),
  pagination: paginationSchema,
});

export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderList = z.infer<typeof orderListSchema>;
