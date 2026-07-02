import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate';
import type { Request, Response, NextFunction } from 'express';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
});

function mockReq(body: unknown): Partial<Request> {
  return { body };
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  it('should call next() on valid data', () => {
    const req = mockReq({ name: 'Tata', age: 25 }) as Request;
    const res = mockRes() as Response;
    const next: NextFunction = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 on invalid data', () => {
    const req = mockReq({ name: '', age: -5 }) as Request;
    const res = mockRes() as Response;
    const next: NextFunction = vi.fn();

    validate(testSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should return field errors', () => {
    const req = mockReq({ name: '', age: -5 }) as Request;
    const res = mockRes() as Response;
    const next: NextFunction = vi.fn();

    validate(testSchema)(req, res, next);

    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.fields).toBeDefined();
  });
});
