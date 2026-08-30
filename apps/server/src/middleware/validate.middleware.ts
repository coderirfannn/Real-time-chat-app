import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodTypeAny, ZodError } from 'zod';
import { ValidationError } from '../errors/app-error.js';

export interface ValidationTargetSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationTargetSchemas): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as Request['query'];
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as Request['params'];
      }
      next();
    } catch (error) {
      const zodError = error as ZodError;
      const formattedErrors = zodError.errors?.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })) || [{ message: 'Invalid request payload' }];

      next(new ValidationError('Validation failed for request parameters', formattedErrors));
    }
  };
}
