import axios, { type AxiosInstance, type AxiosResponse, AxiosError } from 'axios';

export interface HttpClientOptions {
  baseURL: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export type Response<T> = {
  status: number;
  headers: Record<string, string>;
  data: T;
};

const normalizeHeaders = (headers: unknown): Record<string, string> => {
  if (!headers || typeof headers !== 'object') return {};
  return Object.fromEntries(
    Object.entries(headers as Record<string, unknown>).map(([k, v]) => [
      k.toLowerCase(),
      String(v),
    ]),
  );
};

const toResponse = <T>(res: AxiosResponse<T>): Response<T> => ({
  status: res.status,
  headers: normalizeHeaders(res.headers),
  data: res.data,
});

const toErrorResponse = (error: unknown): Response<unknown> => {
  if (error instanceof AxiosError && error.response) {
    return toResponse(error.response);
  }
  throw error;
};

export class HttpClient {
  protected readonly instance: AxiosInstance;

  constructor(options: HttpClientOptions) {
    this.instance = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout ?? 15_000,
      headers: { accept: 'application/json', ...(options.defaultHeaders ?? {}) },
      validateStatus: () => true,
    });
  }

  withAuth(token: string): this {
    this.instance.defaults.headers.common['authorization'] = `Bearer ${token}`;
    return this;
  }

  withHeader(name: string, value: string): this {
    this.instance.defaults.headers.common[name.toLowerCase()] = value;
    return this;
  }

  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<Response<T>> {
    try {
      const res = await this.instance.get<T>(path, { params });
      return toResponse(res);
    } catch (error) {
      return toErrorResponse(error) as Response<T>;
    }
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<Response<T>> {
    try {
      const res = await this.instance.post<T>(path, body);
      return toResponse(res);
    } catch (error) {
      return toErrorResponse(error) as Response<T>;
    }
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<Response<T>> {
    try {
      const res = await this.instance.patch<T>(path, body);
      return toResponse(res);
    } catch (error) {
      return toErrorResponse(error) as Response<T>;
    }
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<Response<T>> {
    try {
      const res = await this.instance.put<T>(path, body);
      return toResponse(res);
    } catch (error) {
      return toErrorResponse(error) as Response<T>;
    }
  }

  async delete<T = unknown>(path: string): Promise<Response<T>> {
    try {
      const res = await this.instance.delete<T>(path);
      return toResponse(res);
    } catch (error) {
      return toErrorResponse(error) as Response<T>;
    }
  }
}
