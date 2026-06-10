import { usersService } from '../services/users.service.js';
import { ordersService } from '../services/orders.service.js';
import { prisma } from '../prisma.js';

export const resolvers = {
  Query: {
    user: async (_: unknown, args: { id: string }) => usersService.getById(args.id),
    users: async (
      _: unknown,
      args: { page?: number; perPage?: number; role?: 'admin' | 'user' | 'guest' },
    ) =>
      usersService.list({
        page: args.page ?? 1,
        perPage: args.perPage ?? 20,
        ...(args.role ? { role: args.role } : {}),
      }),
    order: async (_: unknown, args: { id: string }) => ordersService.getById(args.id),
    orders: async (
      _: unknown,
      args: {
        page?: number;
        perPage?: number;
        status?: 'pending' | 'paid' | 'shipped' | 'cancelled';
      },
    ) =>
      ordersService.list({
        page: args.page ?? 1,
        perPage: args.perPage ?? 20,
        ...(args.status ? { status: args.status } : {}),
      }),
  },
  Mutation: {
    createUser: async (
      _: unknown,
      args: {
        input: { email: string; name: string; password: string; role?: 'admin' | 'user' | 'guest' };
      },
    ) => usersService.create(args.input),
  },
  User: {
    orders: async (parent: { id: string }) => {
      const rows = await prisma.order.findMany({
        where: { userId: parent.id },
        include: { items: true },
      });
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        status: row.status,
        totalCents: row.totalCents,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        items: row.items,
      }));
    },
  },
  Order: {
    user: async (parent: { userId: string }) => usersService.getById(parent.userId),
  },
};
