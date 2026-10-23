import { envConfig } from './config';

function resolveApiUrl(path: string): { url: string; credentials: RequestCredentials } {
  const base = (envConfig.apiBaseUrl || '/api').replace(/\/+$/, '');
  const isCrossOrigin = base.startsWith('http://') || base.startsWith('https://');
  return {
    url: `${base}${path}`,
    credentials: isCrossOrigin ? 'include' : 'same-origin',
  };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { url, credentials } = resolveApiUrl(path);
  const res = await fetch(url, {
    credentials,
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const destroy = (path: string) => api<void>(path, { method: 'DELETE' });

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const { url, credentials } = resolveApiUrl(path);
  const res = await fetch(url, { method: 'POST', credentials, body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}
