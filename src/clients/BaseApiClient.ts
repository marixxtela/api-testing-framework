import { HttpClient, type HttpClientOptions } from '../utils/http.js';

export abstract class BaseApiClient extends HttpClient {
  constructor(options: HttpClientOptions | string) {
    super(typeof options === 'string' ? { baseURL: options } : options);
  }

  protected static resolveBaseURL(input?: string): string {
    return input ?? process.env.API_BASE_URL ?? 'http://localhost:3000';
  }
}
