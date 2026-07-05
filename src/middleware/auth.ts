import type { Request, Response, NextFunction } from 'express';
import { sanitizeError } from '../utils/errors';

export { sanitizeError };

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session && (req.session as any).authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login as admin.' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session && (req.session as any).authenticated) {
    return next();
  }
  res.redirect('/login');
}

export async function stockAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const supabase = req.app.get('supabase');
  if (!supabase) {
    next();
    return;
  }

  const { slug } = req.params;
  const token = req.query.token as string | undefined;

  if (token && slug) {
    const { data, error } = await supabase
      .from('users')
      .select('id, store_name, status, store_slug')
      .eq('store_slug', slug)
      .eq('dashboard_token', token)
      .maybeSingle();
    if (!error && data) {
      (req as any).stockUser = data;
      next();
      return;
    }
  }

  if (req.session && (req.session as any).stockUserId) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', (req.session as any).stockUserId)
      .eq('store_slug', slug)
      .maybeSingle();
    if (data) {
      (req as any).stockUser = { id: data.id };
      next();
      return;
    }
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(401).json({ success: false, error: 'Unauthorized. Silakan login terlebih dahulu.' });
    return;
  }
  res.redirect(`/login?redirect=/stock/${slug || ''}`);
}
