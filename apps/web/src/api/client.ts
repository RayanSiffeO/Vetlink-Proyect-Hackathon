/**
 * Cliente HTTP mínimo de VetLink.
 *
 * - `${VITE_API_URL}` por defecto `/api` (el proxy de Vite lo reenvía a :8000).
 * - `credentials: 'include'`: la sesión demo viaja en cookie.
 * - Errores: se normalizan a `ApiError` con `status`, `message` y `detail`
 *   (FastAPI devuelve `{detail: "..."}` o `{detail: [{msg, loc}]}`).
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export class ApiError extends Error {
  status: number;
  detail: unknown;
  url: string;

  constructor(message: string, status: number, detail: unknown, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.url = url;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** Convierte el `detail` de FastAPI en un texto legible en español. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error inesperado';
}

function humanizeDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const loc = Array.isArray(record.loc) ? record.loc.join('.') : '';
          const msg = typeof record.msg === 'string' ? record.msg : JSON.stringify(record);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean);
    return parts.join(' · ') || 'Datos no válidos';
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.msg === 'string') return record.msg;
    if (typeof record.detail === 'string') return record.detail;
    return JSON.stringify(detail);
  }
  return 'Error de la API';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal, headers } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const init: RequestInit = {
    method,
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  };

  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      'No se puede contactar con la API. Comprueba que el backend esté arrancado en http://localhost:8000.',
      0,
      null,
      url,
    );
  }

  const raw = await response.text();
  const hasBody = raw.length > 0;
  let data: unknown = null;

  if (hasBody) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    } else {
      data = raw;
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in (data as Record<string, unknown>)
        ? (data as Record<string, unknown>).detail
        : data;
    throw new ApiError(humanizeDetail(detail), response.status, detail, url);
  }

  return data as T;
}
