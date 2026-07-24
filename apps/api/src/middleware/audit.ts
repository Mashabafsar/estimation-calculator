import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

export async function auditLog(req: Request, _res: Response, next: NextFunction) {
  const originalJson = resJsonBinder(req);
  // Lightweight: log mutating requests after handlers via next; detailed logs in services
  (req as any)._audit = async (action: string, entityType: string, entityId?: string, metadata?: unknown) => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action,
          entityType,
          entityId,
          metadata: metadata as any,
          ipAddress: req.ip,
        },
      });
    } catch (e) {
      console.warn('Audit log failed', e);
    }
  };
  void originalJson;
  next();
}

function resJsonBinder(_req: Request) {
  return null;
}
