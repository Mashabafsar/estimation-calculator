import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  const anyErr = err as { type?: string; status?: number; statusCode?: number; message?: string };
  if (anyErr?.type === 'entity.too.large' || anyErr?.status === 413 || anyErr?.statusCode === 413) {
    return res.status(413).json({
      success: false,
      message: 'Image must be under 10MB',
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Not found' });
}
