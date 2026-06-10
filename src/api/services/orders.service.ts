import { prisma } from '../prisma.js';
import { ApiError } from '../errors.js';
import type { CreateOrderBody, OrderDto, UpdateOrderStatusBody } from '../schemas.js';

type OrderWithItems = Awaited<ReturnType<typeof prisma.order.findUnique>> & {
  items: { id: string; sku: string; description: string; quantity: number; priceCents: number }[];
};

const toDto = (order: OrderWithItems): OrderDto => ({
  id: order!.id,
  userId: order!.userId,
  status: order!.status as OrderDto['status'],
  totalCents: order!.totalCents,
  currency: order!.currency,
  createdAt: order!.createdAt.toISOString(),
  items: order!.items.map((item) => ({
    id: item.id,
    sku: item.sku,
    description: item.description,
    quantity: item.quantity,
    priceCents: item.priceCents,
  })),
});

const sumTotal = (items: CreateOrderBody['items']): number =>
  items.reduce((acc, item) => acc + item.quantity * item.priceCents, 0);

export interface ListOrdersParams {
  page: number;
  perPage: number;
  status?: OrderDto['status'];
  userId?: string;
}

export const ordersService = {
  async list(
    params: ListOrdersParams,
  ): Promise<{ data: OrderDto[]; pagination: { page: number; perPage: number; total: number } }> {
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
    ]);

    return {
      data: rows.map((row) => toDto(row as OrderWithItems)),
      pagination: { page: params.page, perPage: params.perPage, total },
    };
  },

  async getById(id: string): Promise<OrderDto> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw ApiError.notFound('ORDER_NOT_FOUND', `Order ${id} not found`);
    }
    return toDto(order as OrderWithItems);
  },

  async create(body: CreateOrderBody): Promise<OrderDto> {
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      throw ApiError.notFound('USER_NOT_FOUND', `User ${body.userId} not found`);
    }

    const created = await prisma.order.create({
      data: {
        userId: body.userId,
        status: 'pending',
        currency: body.currency,
        totalCents: sumTotal(body.items),
        items: { create: body.items },
      },
      include: { items: true },
    });

    return toDto(created as OrderWithItems);
  },

  async updateStatus(id: string, body: UpdateOrderStatusBody): Promise<OrderDto> {
    try {
      const updated = await prisma.order.update({
        where: { id },
        data: { status: body.status },
        include: { items: true },
      });
      return toDto(updated as OrderWithItems);
    } catch {
      throw ApiError.notFound('ORDER_NOT_FOUND', `Order ${id} not found`);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.order.delete({ where: { id } });
    } catch {
      throw ApiError.notFound('ORDER_NOT_FOUND', `Order ${id} not found`);
    }
  },
};
