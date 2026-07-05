import { useEffect, useState } from 'react';
import { useStockStore } from '../store/stockStore';
import { stockApi } from '../services/api';

export function useStockToken(): { token: string | null; isLoading: boolean } {
  const { token, setToken, setUser, setLoading, isLoading } = useStockStore();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token || done) return;

    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || localStorage.getItem('tbs_token');

    if (t) {
      localStorage.setItem('tbs_token', t);
      setToken(t);

      stockApi
        .get<{ id: string; store_name: string; status: string }>('/api/stock/verify', t)
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('tbs_token');
          setToken('');
        })
        .finally(() => {
          setLoading(false);
          setDone(true);
        });
    } else {
      setLoading(false);
      setDone(true);
    }
  }, [token, done, setToken, setUser, setLoading]);

  return { token, isLoading };
}
