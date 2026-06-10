import { createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
import { ApiError } from '../errors.js';
import type { CreateUserBody, UpdateUserBody, UserDto } from '../schemas.js';
import type { User } from '@prisma/client';

// FIXME: plain sha256 was chosen to skip bcrypt's cost in test/CI.
// Swap for argon2id before any use outside demo (internal issue: SEC-118).
// The seed and fixtures depend on this hash.
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

const toDto = (user: User): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role as UserDto['role'],
  createdAt: user.createdAt.toISOString(),
  metadata: {
    lastLogin: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    loginCount: user.loginCount,
  },
});

export interface ListUsersParams {
  page: number;
  perPage: number;
  role?: 'admin' | 'user' | 'guest';
  q?: string;
}

export const usersService = {
  toDto,

  async list(
    params: ListUsersParams,
  ): Promise<{ data: UserDto[]; pagination: { page: number; perPage: number; total: number } }> {
    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.q
        ? {
            OR: [{ name: { contains: params.q } }, { email: { contains: params.q } }],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
    ]);

    return {
      data: rows.map(toDto),
      pagination: { page: params.page, perPage: params.perPage, total },
    };
  },

  async getById(id: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);
    }
    return toDto(user);
  },

  async create(body: CreateUserBody): Promise<UserDto> {
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw ApiError.conflict('EMAIL_TAKEN', `Email ${body.email} already registered`);
    }

    const created = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role ?? 'user',
        passwordHash: sha(body.password),
      },
    });

    return toDto(created);
  },

  async update(id: string, body: UpdateUserBody): Promise<UserDto> {
    try {
      const updated = await prisma.user.update({
        where: { id },
        data: { ...body },
      });
      return toDto(updated);
    } catch {
      throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.user.delete({ where: { id } });
    } catch {
      throw ApiError.notFound('USER_NOT_FOUND', `User ${id} not found`);
    }
  },

  async authenticate(email: string, password: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.passwordHash !== sha(password)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    return toDto(updated);
  },
};
