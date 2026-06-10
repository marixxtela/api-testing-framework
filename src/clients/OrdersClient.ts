import { BaseApiClient } from './BaseApiClient.js';
import type { Response } from '../utils/http.js';
import type { Order, OrderList, OrderStatus } from '../schemas/order.schema.js';

export interface ListOrdersQuery {
  page?: number;
  perPage?: number;
  status?: OrderStatus;
  userId?: string;
}

export interface CreateOrderItemInput {
  sku: string;
  description: string;
  quantity: number;
  priceCents: number;
}

export interface CreateOrderInput {
  userId: string;
  currency?: string;
  items: CreateOrderItemInput[];
}

export class OrdersClient extends BaseApiClient {
  constructor(baseURL?: string) {
    super(BaseApiClient['resolveBaseURL'](baseURL));
  }

  list(query: ListOrdersQuery = {}): Promise<Response<OrderList>> {
    return this.get<OrderList>('/orders', query as Record<string, unknown>);
  }

  getById(id: string): Promise<Response<Order>> {
    return this.get<Order>(`/orders/${id}`);
  }

  create(input: CreateOrderInput): Promise<Response<Order>> {
    return this.post<Order>('/orders', input);
  }

  updateStatus(id: string, status: OrderStatus): Promise<Response<Order>> {
    return this.patch<Order>(`/orders/${id}/status`, { status });
  }

  remove(id: string): Promise<Response<unknown>> {
    return this.delete(`/orders/${id}`);
  }
}
