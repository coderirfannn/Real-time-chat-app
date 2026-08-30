import type { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRequestHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: Request<any, any, any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res: Response<any>,
  next: NextFunction,
) => Promise<unknown> | unknown;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
