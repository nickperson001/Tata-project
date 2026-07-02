import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten();
      res.status(400).json({
        success: false,
        error: 'Validasi gagal',
        fields: errors.fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.flatten();
      res.status(400).json({
        success: false,
        error: 'Validasi query gagal',
        fields: errors.fieldErrors,
      });
      return;
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}
