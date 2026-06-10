import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'USER_NOT_FOUND',
  'ORDER_NOT_FOUND',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);

export const errorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
