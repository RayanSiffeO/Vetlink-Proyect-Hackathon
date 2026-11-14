export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const NETWORK_ERROR_MESSAGE =
  'No se puede contactar con la API. Comprueba que el backend esté arrancado en http://localhost:8000.';

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

function describeDetailRecord(record: Record<string, unknown>): string {
  const loc = Array.isArray(record.loc) ? record.loc.join('.') : '';
  const msg = typeof record.msg === 'string' ? record.msg : JSON.stringify(record);
  return loc ? `${loc}: ${msg}` : msg;
}

function describeDetailEntry(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return describeDetailRecord(item as Record<string, unknown>);
  return String(item);
}

function humanizeArrayDetail(detail: unknown[]): string {
  const parts = detail.map(describeDetailEntry).filter(Boolean);
  return parts.join(' · ') || 'Datos no válidos';
}

function humanizeObjectDetail(detail: Record<string, unknown>): string {
  if (typeof detail.message === 'string') return detail.message;
  if (typeof detail.msg === 'string') return detail.msg;
  if (typeof detail.detail === 'string') return detail.detail;
  return JSON.stringify(detail);
}

function humanizeDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return humanizeArrayDetail(detail);
  if (detail && typeof detail === 'object') {
    return humanizeObjectDetail(detail as Record<string, unknown>);
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

function resolveUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildInit(options: RequestOptions): RequestInit {
  const { method = 'GET', body, formData, signal, headers } = options;
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
    return init;
  }

  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  return init;
}

function isJsonResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes('application/json');
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  if (!isJsonResponse(response)) return raw;
  return safeJsonParse(raw);
}

function toNetworkError(error: unknown, url: string): unknown {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  return new ApiError(NETWORK_ERROR_MESSAGE, 0, null, url);
}

function extractDetail(data: unknown): unknown {
  const isRecord = data && typeof data === 'object' && 'detail' in data;
  if (!isRecord) return data;
  return (data as Record<string, unknown>).detail;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = resolveUrl(path);
  let response: Response;

  try {
    response = await fetch(url, buildInit(options));
  } catch (error) {
    throw toNetworkError(error, url);
  }

  const data = await parseResponseBody(response);
  if (response.ok) return data as T;

  if (response.status === 401) unauthorizedHandler?.();

  const detail = extractDetail(data);
  throw new ApiError(humanizeDetail(detail), response.status, detail, url);
}
