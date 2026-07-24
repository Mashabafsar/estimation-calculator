const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return (await res.text()) as T;
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.message || 'Request failed', res.status);
  }
  return (json.data ?? json) as T;
}

export function money(n?: number | string | null, currency = 'USD') {
  const value = Number(n ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function pct(n?: number | string | null, digits = 1) {
  return `${Number(n ?? 0).toFixed(digits)}%`;
}
