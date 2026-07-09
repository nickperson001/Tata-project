import type { Response } from 'express';
import { ErrorCode, type ErrorCode as ErrorCodeType } from '../types/errors';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function apiSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function apiSuccessPaginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
  res.status(200).json({ success: true, data, meta });
}

export function apiError(
  res: Response,
  error: string,
  codeOrStatus?: ErrorCodeType | number,
  status?: number,
  fields?: Record<string, string>,
): void {
  let errCode: ErrorCodeType = ErrorCode.INTERNAL;
  let httpStatus = 400;

  if (codeOrStatus !== undefined) {
    if (typeof codeOrStatus === 'number') {
      httpStatus = codeOrStatus;
    } else {
      errCode = codeOrStatus;
      httpStatus = status ?? 400;
    }
  }
  if (typeof status === 'number') {
    httpStatus = status;
  }

  if (httpStatus !== 503 && error?.includes('[SUPABASE ERROR]')) {
    httpStatus = 503;
  }
  res.status(httpStatus).json({ success: false, error, code: errCode, ...(fields && { fields }) });
}
