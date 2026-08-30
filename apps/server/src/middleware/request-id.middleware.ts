import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header(REQUEST_ID_HEADER);
  const id = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : randomUUID();

  req.id = id;
  req.startTime = Date.now();
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}
