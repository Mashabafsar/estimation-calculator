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

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Not found' });
}
