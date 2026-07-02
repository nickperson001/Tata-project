import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

export function StockSlugRedirect() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const qs = token ? `?token=${token}` : '';
    navigate(`/stock${qs}`, { replace: true });
  }, [slug, searchParams, navigate]);

  return null;
}
