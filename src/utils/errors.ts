import { ErrorCode, type ErrorCode as ErrorCodeType } from '../types/errors';

export function sanitizeError(err: unknown): string {
  let msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as Error).message)
        : String(err);
  if (msg.indexOf('<!DOCTYPE') >= 0 || msg.indexOf('<html') >= 0 || msg.indexOf('Cloudflare') >= 0) {
    return '[SUPABASE ERROR] API Down / Cloudflare 521 (HTML response received)';
  }
  if (msg.length > 500) return msg.substring(0, 500) + '...';
  return msg;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: ErrorCodeType = ErrorCode.INTERNAL,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function badRequest(msg: string): AppError {
  return new AppError(400, msg, ErrorCode.VALIDATION);
}

export function unauthorized(msg: string): AppError {
  return new AppError(401, msg, ErrorCode.AUTH_INVALID);
}

export function notFound(msg: string): AppError {
  return new AppError(404, msg, ErrorCode.NOT_FOUND);
}

export function tooManyRequests(msg: string): AppError {
  return new AppError(429, msg, ErrorCode.RATE_LIMIT);
}
