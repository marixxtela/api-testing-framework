import { faker } from '@faker-js/faker';
import type { CreateOrderInput, CreateOrderItemInput } from '../clients/OrdersClient.js';

export class OrderBuilder {
  private payload: CreateOrderInput;

  constructor(userId: string) {
    this.payload = {
      userId,
      currency: 'BRL',
      items: [OrderBuilder.randomItem()],
    };
  }

  static randomItem(): CreateOrderItemInput {
    return {
      sku: `SKU-${faker.string.alphanumeric({ length: 6, casing: 'upper' })}`,
      description: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 5 }),
      priceCents: faker.number.int({ min: 100, max: 50_000 }),
    };
  }

  withCurrency(currency: string): this {
    this.payload.currency = currency;
    return this;
  }

  withItem(item: CreateOrderItemInput): this {
    this.payload.items.push(item);
    return this;
  }

  withItems(count: number): this {
    this.payload.items = Array.from({ length: count }, () => OrderBuilder.randomItem());
    return this;
  }

  withRandomItems(): this {
    return this.withItems(faker.number.int({ min: 1, max: 4 }));
  }

  forUser(userId: string): this {
    this.payload.userId = userId;
    return this;
  }

  build(): CreateOrderInput {
    return { ...this.payload, items: [...this.payload.items] };
  }
}
