import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }
    next();
  };
}

/** Write operations blocked for READ_ONLY */
export function requireWrite(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (req.user.role === 'READ_ONLY') return next(new AppError('Read-only users cannot modify data', 403));
  next();
}
