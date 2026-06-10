import { GraphQLClient as Inner, type Variables } from 'graphql-request';

export class GraphQLApiClient {
  private readonly client: Inner;

  constructor(baseURL?: string, headers: Record<string, string> = {}) {
    const url = `${baseURL ?? process.env.API_BASE_URL ?? 'http://localhost:3000'}/graphql`;
    this.client = new Inner(url, { headers });
  }

  withAuth(token: string): this {
    this.client.setHeader('authorization', `Bearer ${token}`);
    return this;
  }

  async query<T = unknown>(document: string, variables?: Variables): Promise<T> {
    return this.client.request<T>(document, variables);
  }

  async rawRequest<T = unknown>(
    document: string,
    variables?: Variables,
  ): Promise<{ data: T; status: number; headers: Headers }> {
    return this.client.rawRequest<T>(document, variables);
  }
}
