import type { Request, Response, NextFunction } from 'express';

export function sanitizeError(err: unknown): string {
  let msg =
    typeof err === 'string' ? err : err && typeof err === 'object' && 'message' in err
      ? String((err as Error).message)
      : String(err);
  if (msg.indexOf('<!DOCTYPE') >= 0 || msg.indexOf('<html') >= 0 || msg.indexOf('Cloudflare') >= 0) {
    return '[SUPABASE ERROR] API Down / Cloudflare 521 (HTML response received)';
  }
  if (msg.length > 500) return msg.substring(0, 500) + '...';
  return msg;
}

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

export async function stockAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
