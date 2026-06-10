import type { Request, Response, NextFunction } from 'express';

interface SessionUser {
  email: string;
  displayName: string;
  provider: string;
  claims: Record<string, unknown>;
}

interface AuthorizationConfig {
  allowedEmails?: string[];
  allowedClaim?: { name: string; values: string[] };
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    oidcState?: string;
    oidcNonce?: string;
    oidcCodeVerifier?: string;
  }
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/auth/login');
  }
}

export function isAllowed(authorization: AuthorizationConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session.user;
    if (!user) {
      res.status(403).render('denied');
      return;
    }

    if (authorization.allowedEmails?.includes(user.email)) {
      next();
      return;
    }

    if (authorization.allowedClaim) {
      const claimValue = user.claims[authorization.allowedClaim.name];
      const allowed = authorization.allowedClaim.values;
      if (Array.isArray(claimValue)) {
        if (claimValue.some((v) => allowed.includes(String(v)))) {
          next();
          return;
        }
      } else if (typeof claimValue === 'string' && allowed.includes(claimValue)) {
        next();
        return;
      }
    }

    res.status(403).render('denied');
  };
}
