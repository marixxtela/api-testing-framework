import { BaseApiClient } from './BaseApiClient.js';
import type { Response } from '../utils/http.js';
import type { User, UserList, LoginResponse } from '../schemas/user.schema.js';

export interface ListUsersQuery {
  page?: number;
  perPage?: number;
  role?: 'admin' | 'user' | 'guest';
  q?: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface UpdateUserInput {
  name?: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface SearchQuery {
  q: string;
}

export class UsersClient extends BaseApiClient {
  constructor(baseURL?: string) {
    super(BaseApiClient['resolveBaseURL'](baseURL));
  }

  list(query: ListUsersQuery = {}): Promise<Response<UserList>> {
    return this.get<UserList>('/users', query as Record<string, unknown>);
  }

  getById(id: string): Promise<Response<User>> {
    return this.get<User>(`/users/${id}`);
  }

  create(input: CreateUserInput): Promise<Response<User>> {
    return this.post<User>('/users', input);
  }

  update(id: string, input: UpdateUserInput): Promise<Response<User>> {
    return this.patch<User>(`/users/${id}`, input);
  }

  remove(id: string): Promise<Response<unknown>> {
    return this.delete(`/users/${id}`);
  }

  search(query: SearchQuery): Promise<Response<UserList>> {
    return this.get<UserList>('/users', { ...query });
  }

  login(email: string, password: string): Promise<Response<LoginResponse>> {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  me(): Promise<Response<User>> {
    return this.get<User>('/auth/me');
  }
}
