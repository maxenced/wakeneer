import { describe, it, expect, vi } from 'vitest';
import { isAuthenticated, isAllowed } from '../../src/auth/middleware.js';
import type { Request, Response } from 'express';

function mockReq(sessionUser?: Record<string, unknown>): Request {
  return {
    session: sessionUser ? { user: sessionUser } : {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    redirect: vi.fn(),
    status: vi.fn().mockReturnThis(),
    render: vi.fn(),
  } as unknown as Response;
  return res;
}

describe('isAuthenticated', () => {
  it('calls next when session has user', () => {
    const req = mockReq({ email: 'a@b.com', displayName: 'A', provider: 'x', claims: {} });
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('redirects to /auth/login when no session user', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    isAuthenticated(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('isAllowed', () => {
  it('allows when email is in allowedEmails', () => {
    const middleware = isAllowed({ allowedEmails: ['alice@example.com'] });
    const req = mockReq({ email: 'alice@example.com', claims: {} });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows when claim matches allowedClaim', () => {
    const middleware = isAllowed({
      allowedClaim: { name: 'groups', values: ['wakeonlan-users'] },
    });
    const req = mockReq({
      email: 'unknown@example.com',
      claims: { groups: ['wakeonlan-users', 'other'] },
    });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows when claim value is a string matching one of the configured values', () => {
    const middleware = isAllowed({
      allowedClaim: { name: 'role', values: ['admin'] },
    });
    const req = mockReq({ email: 'x@y.com', claims: { role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies when neither email nor claim matches', () => {
    const middleware = isAllowed({
      allowedEmails: ['alice@example.com'],
      allowedClaim: { name: 'groups', values: ['admin'] },
    });
    const req = mockReq({
      email: 'eve@example.com',
      claims: { groups: ['users'] },
    });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith('denied');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows when only allowedEmails is configured and matches', () => {
    const middleware = isAllowed({ allowedEmails: ['bob@test.com'] });
    const req = mockReq({ email: 'bob@test.com', claims: {} });
    const res = mockRes();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
