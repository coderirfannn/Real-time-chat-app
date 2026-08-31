import { describe, it, expect, vi } from 'vitest';
import { cleanNoSqlOperators, sanitizeMiddleware } from '../../middleware/sanitize.middleware.js';
import type { Request, Response, NextFunction } from 'express';

describe('SanitizeMiddleware & NoSQL Injection Protection Unit Tests', () => {
  it('1. STRIP OPERATORS: strips keys starting with $ or containing . from deep objects', () => {
    const maliciousPayload = {
      username: 'alice',
      password: { $gt: '' },
      nested: {
        'profile.admin': true,
        validField: 'hello',
        deepArray: [{ $ne: null }, { safe: 123 }],
      },
    };

    const cleaned = cleanNoSqlOperators(maliciousPayload) as Record<string, unknown>;

    expect(cleaned['username']).toBe('alice');
    expect((cleaned['password'] as Record<string, unknown>)['$gt']).toBeUndefined();
    expect((cleaned['nested'] as Record<string, unknown>)['profile.admin']).toBeUndefined();
    expect((cleaned['nested'] as Record<string, unknown>)['validField']).toBe('hello');
    expect((cleaned['nested'] as Record<string, unknown>)['deepArray']).toEqual([
      {},
      { safe: 123 },
    ]);
  });

  it('2. MIDDLEWARE HOOK: sanitizes req.body, req.query, and req.params in place', () => {
    const req = {
      body: { identifier: 'bob', pass: { $regex: '.*' } },
      query: { q: 'search', filter: { $ne: '' } },
      params: { id: '6a955a298f74016374325510' },
    } as unknown as Request;

    const res = {} as Response;
    const next: NextFunction = vi.fn();

    sanitizeMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body as Record<string, unknown>)['identifier']).toBe('bob');
    expect((req.body as Record<string, unknown>)['pass']).toEqual({});
    expect((req.query as Record<string, unknown>)['q']).toBe('search');
    expect((req.query as Record<string, unknown>)['filter']).toEqual({});
  });
});
