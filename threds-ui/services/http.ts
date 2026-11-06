/**
 * Shared JSON transport for the existing API layer.
 *
 * `fetchJson` throws an Error whose message is suitable for showing in the UI.
 * It is an `HttpError` so callers can branch on status (for example 403 from a
 * Grid key check) without parsing messages.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const messageFromBody = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Not JSON: fall through and use the raw body.
  }

  return trimmed;
};

export const fetchJson = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, init);

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new HttpError(messageFromBody(errorText) || `Request failed: ${res.status}`, res.status);
  }

  return (await res.json()) as T;
};

/** Optimized helper function to convert snake_case payloads to camelCase. */
export const toCamelCase = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.includes('_')
      ? key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      : key;
    result[camelKey] = toCamelCase(obj[key]);
  }
  return result;
};

export const isAbortError = (error: unknown): boolean => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  );
};

/** Consistent, user-facing text for anything the transport can throw. */
export const describeRequestError = (error: unknown, fallback: string): string => {
  if (error instanceof HttpError) {
    return error.message || `${fallback} (${error.status})`;
  }
  if (error instanceof TypeError) {
    // fetch() rejects with TypeError when the network is unreachable.
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};
