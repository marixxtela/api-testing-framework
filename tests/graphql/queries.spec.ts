import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ClientError } from 'graphql-request';
import { GraphQLApiClient } from '../../src/clients/GraphQLClient.js';
import { listenApp } from '../helpers/app-context.js';
import { resetDatabase, seedMinimal } from '../helpers/database.js';

interface UserNode {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  orders: { id: string; status: string; totalCents: number }[];
}

interface OrderNode {
  id: string;
  userId: string;
  status: string;
  totalCents: number;
  currency: string;
  items: { id: string; sku: string; quantity: number; priceCents: number }[];
  user: { id: string; email: string } | null;
}

interface UserPage {
  data: UserNode[];
  pagination: { page: number; perPage: number; total: number };
}

interface OrderPage {
  data: OrderNode[];
  pagination: { page: number; perPage: number; total: number };
}

describe('GraphQL queries and mutations', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  let seeded: { adminId: string; userId: string; orderId: string };
  let gql: GraphQLApiClient;

  beforeAll(async () => {
    const handle = await listenApp();
    baseURL = handle.url;
    close = handle.close;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await resetDatabase();
    seeded = await seedMinimal();
    gql = new GraphQLApiClient(baseURL);
  });

  it('query user(id) returns the user with the nested orders collection', async () => {
    const query = `
      query UserWithOrders($id: ID!) {
        user(id: $id) {
          id
          email
          name
          role
          orders {
            id
            status
            totalCents
          }
        }
      }
    `;

    const response = await gql.query<{ user: UserNode }>(query, { id: seeded.userId });

    expect(response.user).toMatchObject({
      id: seeded.userId,
      email: 'mariana.castro@acme.test',
      role: 'user',
    });
    expect(response.user.orders).toHaveLength(1);
    expect(response.user.orders[0]).toMatchObject({
      id: seeded.orderId,
      status: 'paid',
    });
  });

  it('query users(page, perPage, role) returns a paginated and filtered UserPage', async () => {
    const query = `
      query Users($page: Int!, $perPage: Int!, $role: Role) {
        users(page: $page, perPage: $perPage, role: $role) {
          data { id role email }
          pagination { page perPage total }
        }
      }
    `;

    const response = await gql.query<{ users: UserPage }>(query, {
      page: 1,
      perPage: 10,
      role: 'admin',
    });

    expect(response.users.pagination).toMatchObject({ page: 1, perPage: 10, total: 1 });
    expect(response.users.data).toHaveLength(1);
    expect(response.users.data[0]!.role).toBe('admin');
  });

  it('query order(id) returns the order with items and the user relation', async () => {
    const query = `
      query OrderWithDetails($id: ID!) {
        order(id: $id) {
          id
          userId
          status
          totalCents
          currency
          items { id sku quantity priceCents }
          user { id email }
        }
      }
    `;

    const response = await gql.query<{ order: OrderNode }>(query, { id: seeded.orderId });

    expect(response.order).toMatchObject({
      id: seeded.orderId,
      userId: seeded.userId,
      status: 'paid',
      currency: 'BRL',
    });
    expect(response.order.items.length).toBeGreaterThan(0);
    expect(response.order.user).toMatchObject({
      id: seeded.userId,
      email: 'mariana.castro@acme.test',
    });
  });

  it('query orders(status: paid) returns only orders in the filtered status', async () => {
    const query = `
      query PaidOrders {
        orders(status: paid) {
          data { id status }
          pagination { total }
        }
      }
    `;

    const response = await gql.query<{ orders: OrderPage }>(query);

    expect(response.orders.pagination.total).toBe(1);
    expect(response.orders.data.every((o) => o.status === 'paid')).toBe(true);
  });

  it('mutation createUser creates a new user', async () => {
    const mutation = `
      mutation Create($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          email
          name
          role
        }
      }
    `;

    const input = {
      email: 'new.graphql@example.test',
      name: 'New GraphQL',
      password: 'strong-password-123',
      role: 'user',
    };

    const response = await gql.query<{ createUser: UserNode }>(mutation, { input });

    expect(response.createUser).toMatchObject({
      email: 'new.graphql@example.test',
      name: 'New GraphQL',
      role: 'user',
    });
    expect(response.createUser.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('query user with a non-existent id results in null or a handled graphql error', async () => {
    const query = `
      query MissingUser($id: ID!) {
        user(id: $id) {
          id
        }
      }
    `;

    let captured: { data?: { user: UserNode | null }; errors?: unknown } = {};
    try {
      const data = await gql.query<{ user: UserNode | null }>(query, {
        id: '00000000-0000-0000-0000-0000000000ff',
      });
      captured = { data };
    } catch (error) {
      if (error instanceof ClientError) {
        captured = { errors: error.response.errors, data: error.response.data as { user: null } };
      } else {
        throw error;
      }
    }

    // the current resolver calls usersService.getById which throws ApiError 404;
    // mercurius translates that into a graphql error, so we expect errors or user null.
    const userField = captured.data?.user;
    const hasErrors = Array.isArray(captured.errors) && captured.errors.length > 0;
    expect(userField === null || hasErrors).toBe(true);
  });

  it('introspection confirms the schema exposes Query, Mutation, and the expected types', async () => {
    const introspection = `
      query Introspect {
        __schema {
          queryType { name }
          mutationType { name }
          types { name }
        }
      }
    `;

    const response = await gql.query<{
      __schema: {
        queryType: { name: string };
        mutationType: { name: string } | null;
        types: { name: string }[];
      };
    }>(introspection);

    expect(response.__schema.queryType.name).toBe('Query');
    expect(response.__schema.mutationType?.name).toBe('Mutation');

    const typeNames = response.__schema.types.map((t) => t.name);
    for (const expected of ['User', 'Order', 'UserPage', 'OrderPage', 'OrderItem', 'Pagination']) {
      expect(typeNames).toContain(expected);
    }
  });
});
