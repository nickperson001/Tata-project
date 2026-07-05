const BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (res.status === 401 || res.status === 403) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url);
  },
  post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  del<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' });
  },
};

async function stockRequest<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-stock-token': token, ...options?.headers },
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('tbs_token');
    throw new Error('Sesi habis. Silakan login ulang.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const stockApi = {
  get<T>(url: string, token: string): Promise<T> {
    return stockRequest<T>(url, token);
  },
  post<T>(url: string, token: string, body?: unknown): Promise<T> {
    return stockRequest<T>(url, token, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(url: string, token: string, body?: unknown): Promise<T> {
    return stockRequest<T>(url, token, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  del<T>(url: string, token: string): Promise<T> {
    return stockRequest<T>(url, token, {
      method: 'DELETE',
    });
  },
};
