import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GraphQLApiClient } from '../../src/clients/GraphQLClient.js';
import { listenApp } from '../helpers/app-context.js';

interface IntrospectionField {
  name: string;
  type: { kind: string; name: string | null; ofType: { kind: string; name: string | null } | null };
}

interface IntrospectionInputField {
  name: string;
  type: { kind: string; name: string | null; ofType: { kind: string; name: string | null } | null };
}

interface IntrospectionType {
  name: string;
  kind: string;
  fields: IntrospectionField[] | null;
  inputFields: IntrospectionInputField[] | null;
  enumValues: { name: string }[] | null;
}

const TYPE_QUERY = `
  query TypeDetails($name: String!) {
    __type(name: $name) {
      name
      kind
      fields { name type { kind name ofType { kind name } } }
      inputFields { name type { kind name ofType { kind name } } }
      enumValues { name }
    }
  }
`;

const isNonNull = (type: IntrospectionField['type']): boolean => type.kind === 'NON_NULL';

describe('GraphQL schema (introspection)', () => {
  let baseURL: string;
  let close: () => Promise<void>;
  let gql: GraphQLApiClient;

  beforeAll(async () => {
    const handle = await listenApp();
    baseURL = handle.url;
    close = handle.close;
    gql = new GraphQLApiClient(baseURL);
  });

  afterAll(async () => {
    await close();
  });

  it.each([
    ['User', ['id', 'email', 'name', 'role', 'createdAt', 'orders']],
    ['Order', ['id', 'userId', 'status', 'totalCents', 'currency', 'createdAt', 'items', 'user']],
    ['OrderItem', ['id', 'sku', 'description', 'quantity', 'priceCents']],
    ['UserPage', ['data', 'pagination']],
    ['OrderPage', ['data', 'pagination']],
    ['Pagination', ['page', 'perPage', 'total']],
  ])('type %s exposes the expected fields', async (typeName, expectedFields) => {
    const response = await gql.query<{ __type: IntrospectionType | null }>(TYPE_QUERY, {
      name: typeName,
    });

    expect(response.__type, `type ${typeName} missing`).not.toBeNull();
    const fieldNames = (response.__type!.fields ?? []).map((f) => f.name);
    for (const expected of expectedFields) {
      expect(fieldNames).toContain(expected);
    }
  });

  it('CreateUserInput marks email, name, and password as required and role as optional', async () => {
    const response = await gql.query<{ __type: IntrospectionType | null }>(TYPE_QUERY, {
      name: 'CreateUserInput',
    });

    expect(response.__type).not.toBeNull();
    expect(response.__type!.kind).toBe('INPUT_OBJECT');

    const inputs = response.__type!.inputFields ?? [];
    const byName = new Map(inputs.map((field) => [field.name, field]));

    for (const required of ['email', 'name', 'password']) {
      const field = byName.get(required);
      expect(field, `field ${required} missing`).toBeDefined();
      expect(isNonNull(field!.type), `${required} should be NON_NULL`).toBe(true);
    }

    const role = byName.get('role');
    expect(role).toBeDefined();
    expect(isNonNull(role!.type)).toBe(false);
  });

  it('Role and OrderStatus enums expose the documented values', async () => {
    const roleResp = await gql.query<{ __type: IntrospectionType | null }>(TYPE_QUERY, {
      name: 'Role',
    });
    const statusResp = await gql.query<{ __type: IntrospectionType | null }>(TYPE_QUERY, {
      name: 'OrderStatus',
    });

    expect(roleResp.__type?.kind).toBe('ENUM');
    expect((roleResp.__type?.enumValues ?? []).map((v) => v.name).sort()).toEqual(
      ['admin', 'guest', 'user'].sort(),
    );

    expect(statusResp.__type?.kind).toBe('ENUM');
    expect((statusResp.__type?.enumValues ?? []).map((v) => v.name).sort()).toEqual(
      ['cancelled', 'paid', 'pending', 'shipped'].sort(),
    );
  });

  it('mutation createUser is declared and returns a non-null User', async () => {
    const response = await gql.query<{ __type: IntrospectionType | null }>(TYPE_QUERY, {
      name: 'Mutation',
    });

    const createUser = (response.__type?.fields ?? []).find((f) => f.name === 'createUser');
    expect(createUser, 'mutation createUser missing').toBeDefined();
    expect(isNonNull(createUser!.type)).toBe(true);
    expect(createUser!.type.ofType?.name).toBe('User');
  });
});
