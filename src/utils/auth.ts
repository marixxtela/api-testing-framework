import { HttpClient } from './http.js';

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
  };
}

const cache = new Map<string, AuthSession>();

export async function login(
  baseURL: string,
  creds: Credentials,
  useCache = true,
): Promise<AuthSession> {
  const key = `${baseURL}::${creds.email}`;
  if (useCache && cache.has(key)) {
    return cache.get(key)!;
  }

  const http = new HttpClient({ baseURL });
  const response = await http.post<AuthSession>('/auth/login', creds);

  if (response.status !== 200) {
    throw new Error(`login failed (${response.status}): ${JSON.stringify(response.data)}`);
  }

  cache.set(key, response.data);
  return response.data;
}

export function clearAuthCache(): void {
  cache.clear();
}

export const adminCredentials: Credentials = {
  email: 'ricardo.menezes@acme.test',
  password: 'Adm.7421!checkout',
};

export const userCredentials: Credentials = {
  email: 'mariana.castro@acme.test',
  password: 'Mc.92!staging-key',
};
