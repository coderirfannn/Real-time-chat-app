import type { Request, Response, NextFunction } from 'express';

/**
 * Recursively cleans an object by stripping keys that start with '$' or contain '.'
 * to prevent NoSQL operator injection attacks.
 */
export function cleanNoSqlOperators(target: unknown): unknown {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => cleanNoSqlOperators(item));
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    // Strip keys starting with '$' or containing '.'
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }

    if (value !== null && typeof value === 'object') {
      cleaned[key] = cleanNoSqlOperators(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * against NoSQL query operator injection attacks.
 */
export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = cleanNoSqlOperators(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = cleanNoSqlOperators(req.query) as Request['query'];
  }

  if (req.params && typeof req.params === 'object') {
    req.params = cleanNoSqlOperators(req.params) as Request['params'];
  }

  next();
}
