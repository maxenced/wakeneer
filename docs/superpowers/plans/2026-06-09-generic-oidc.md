# Generic OIDC Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Passport.js with direct openid-client v5 OIDC flow, supporting any provider (Authelia, Keycloak, Google, Microsoft) via discoveryUrl config.

**Architecture:** Each configured provider is discovered at startup via `Issuer.discover()`. Auth routes are dynamic (`/auth/:provider`). Session stores user profile + raw ID token claims. Authorization middleware checks `allowedEmails` OR `allowedClaim` (OR logic).

**Tech Stack:** openid-client v5, express-session, Express 5, TypeScript 6, Vitest

---

### Task 1: Create `src/auth/oidc.ts` — Provider Registry

**Files:**
- Create: `src/auth/oidc.ts`
- Test: `tests/auth/oidc.test.ts`

- [ ] **Step 1: Write the failing test for `initProviders`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from '../../src/config.js';

vi.mock('openid-client', () => ({
  Issuer: {
    discover: vi.fn(),
  },
  generators: {
    state: vi.fn(() => 'mock-state'),
    nonce: vi.fn(() => 'mock-nonce'),
  },
}));

import { Issuer } from 'openid-client';
import { initProviders } from '../../src/auth/oidc.js';

const mockClient = {
  authorizationUrl: vi.fn(() => 'https://auth.example.com/authorize?...'),
  callbackParams: vi.fn(),
  callback: vi.fn(),
};

const mockIssuer = {
  Client: vi.fn(() => mockClient),
};

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    name: 'authelia',
    discoveryUrl: 'https://auth.example.com/.well-known/openid-configuration',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    scopes: ['openid', 'email', 'profile'],
    authorization: { allowedEmails: ['user@example.com'] },
    ...overrides,
  } as ProviderConfig;
}

describe('initProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Issuer.discover).mockResolvedValue(mockIssuer as any);
  });

  it('discovers each provider and returns a registry', async () => {
    const providers = [makeProvider()];
    const registry = await initProviders(providers, 'http://localhost:3000');

    expect(Issuer.discover).toHaveBeenCalledWith('https://auth.example.com/.well-known/openid-configuration');
    expect(registry.get('authelia')).toBeDefined();
  });

  it('throws if discovery fails', async () => {
    vi.mocked(Issuer.discover).mockRejectedValue(new Error('network error'));
    const providers = [makeProvider()];

    await expect(initProviders(providers, 'http://localhost:3000')).rejects.toThrow('network error');
  });

  it('creates client with correct metadata', async () => {
    const providers = [makeProvider()];
    await initProviders(providers, 'http://localhost:3000');

    expect(mockIssuer.Client).toHaveBeenCalledWith({
      client_id: 'test-client',
      client_secret: 'test-secret',
      redirect_uris: ['http://localhost:3000/auth/authelia/callback'],
      response_types: ['code'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/oidc.test.ts`
Expected: FAIL — cannot resolve `../../src/auth/oidc.js`

- [ ] **Step 3: Write the implementation**

```ts
import { Issuer, type BaseClient } from 'openid-client';
import type { ProviderConfig } from '../config.js';

export interface ProviderEntry {
  client: BaseClient;
  config: ProviderConfig;
}

export type ProviderRegistry = Map<string, ProviderEntry>;

export async function initProviders(
  providers: ProviderConfig[],
  callbackBaseUrl: string,
): Promise<ProviderRegistry> {
  const registry: ProviderRegistry = new Map();

  const results = await Promise.all(
    providers.map(async (providerConfig) => {
      const issuer = await Issuer.discover(providerConfig.discoveryUrl);
      const client = new issuer.Client({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        redirect_uris: [`${callbackBaseUrl}/auth/${providerConfig.name}/callback`],
        response_types: ['code'],
      });
      return { name: providerConfig.name, client, config: providerConfig };
    }),
  );

  for (const { name, client, config } of results) {
    registry.set(name, { client, config });
  }

  return registry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/oidc.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/oidc.ts tests/auth/oidc.test.ts
git commit -m "feat(auth): add OIDC provider registry with discovery"
```

---

### Task 2: Rewrite `src/auth/middleware.ts` — Dual-Mode Authorization

**Files:**
- Modify: `src/auth/middleware.ts`
- Modify: `tests/auth/middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `tests/auth/middleware.test.ts` entirely:

```ts
import { describe, it, expect, vi } from 'vitest';
import { isAuthenticated, isAllowed } from '../../src/auth/middleware.js';
import type { Request, Response, NextFunction } from 'express';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/middleware.test.ts`
Expected: FAIL — signature mismatch / session-based checks don't exist yet

- [ ] **Step 3: Rewrite the implementation**

Replace `src/auth/middleware.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/middleware.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/middleware.ts tests/auth/middleware.test.ts
git commit -m "feat(auth): rewrite middleware for session-based dual-mode authorization"
```

---

### Task 3: Rewrite `src/routes/auth.ts` — Dynamic Provider Routes

**Files:**
- Modify: `src/routes/auth.ts`
- Create: `tests/routes/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { createAuthRoutes } from '../../src/routes/auth.js';
import type { ProviderRegistry } from '../../src/auth/oidc.js';

const mockClient = {
  authorizationUrl: vi.fn(() => 'https://auth.example.com/authorize?redirect'),
  callbackParams: vi.fn(() => ({ code: 'test-code', state: 'mock-state' })),
  callback: vi.fn(() => ({
    claims: () => ({
      email: 'user@example.com',
      name: 'Test User',
      sub: '123',
      groups: ['admin'],
    }),
  })),
};

const mockRegistry: ProviderRegistry = new Map([
  [
    'authelia',
    {
      client: mockClient as any,
      config: {
        name: 'authelia',
        discoveryUrl: 'https://auth.example.com/.well-known/openid-configuration',
        clientId: 'cid',
        clientSecret: 'csec',
        scopes: ['openid', 'email', 'profile'],
        authorization: { allowedEmails: ['user@example.com'] },
      } as any,
    },
  ],
]);

function createTestApp(registry: ProviderRegistry) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', 'src/views');
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/auth', createAuthRoutes(registry));
  return app;
}

vi.mock('openid-client', () => ({
  generators: {
    state: () => 'mock-state',
    nonce: () => 'mock-nonce',
  },
}));

describe('auth routes', () => {
  it('GET /auth/login renders login with provider names', async () => {
    const app = createTestApp(mockRegistry);
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('authelia');
  });

  it('GET /auth/:provider redirects to authorization URL', async () => {
    const app = createTestApp(mockRegistry);
    const res = await request(app).get('/auth/authelia');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://auth.example.com/authorize?redirect');
  });

  it('GET /auth/unknown-provider returns 404', async () => {
    const app = createTestApp(mockRegistry);
    const res = await request(app).get('/auth/unknown');
    expect(res.status).toBe(404);
  });

  it('GET /auth/logout destroys session and redirects', async () => {
    const app = createTestApp(mockRegistry);
    const res = await request(app).get('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth.test.ts`
Expected: FAIL — current auth.ts has old signature

- [ ] **Step 3: Rewrite the implementation**

Replace `src/routes/auth.ts`:

```ts
import { Router } from 'express';
import { generators } from 'openid-client';
import { logger } from '../logger.js';
import type { ProviderRegistry } from '../auth/oidc.js';

export function createAuthRoutes(registry: ProviderRegistry): Router {
  const router = Router();

  router.get('/login', (req, res) => {
    const providers = Array.from(registry.keys());
    res.render('login', { providers });
  });

  router.get('/:provider', (req, res) => {
    const entry = registry.get(req.params.provider);
    if (!entry) {
      res.status(404).send('Unknown provider');
      return;
    }

    const state = generators.state();
    const nonce = generators.nonce();
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    const authUrl = entry.client.authorizationUrl({
      scope: entry.config.scopes.join(' '),
      state,
      nonce,
    });

    res.redirect(authUrl);
  });

  router.get('/:provider/callback', async (req, res) => {
    const entry = registry.get(req.params.provider);
    if (!entry) {
      res.status(404).send('Unknown provider');
      return;
    }

    try {
      const params = entry.client.callbackParams(req);
      const tokenSet = await entry.client.callback(
        `${req.protocol}://${req.get('host')}/auth/${req.params.provider}/callback`,
        params,
        { state: req.session.oidcState, nonce: req.session.oidcNonce },
      );

      const claims = tokenSet.claims();
      req.session.user = {
        email: (claims.email as string) ?? '',
        displayName: (claims.name as string) ?? (claims.preferred_username as string) ?? '',
        provider: req.params.provider,
        claims: claims as Record<string, unknown>,
      };
      delete req.session.oidcState;
      delete req.session.oidcNonce;

      logger.info('User logged in', { email: req.session.user.email, provider: req.params.provider });
      res.redirect('/');
    } catch (err) {
      logger.warn('OIDC callback failed', { provider: req.params.provider, error: (err as Error).message });
      res.redirect('/auth/login');
    }
  });

  router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.ts tests/routes/auth.test.ts
git commit -m "feat(auth): rewrite auth routes for dynamic OIDC providers"
```

---

### Task 4: Update `src/server.ts` — Remove Passport, Wire OIDC

**Files:**
- Modify: `src/server.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite `src/server.ts`**

```ts
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './config.js';
import type { ProviderRegistry } from './auth/oidc.js';
import { isAuthenticated, isAllowed } from './auth/middleware.js';
import { Monitor } from './monitor/monitor.js';
import { createAuthRoutes } from './routes/auth.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createWakeRoutes } from './routes/wake.js';
import { createSseRoutes } from './routes/sse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(config: AppConfig, monitor: Monitor, registry: ProviderRegistry): express.Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      secret: config.server.sessionSecret,
      resave: false,
      saveUninitialized: false,
    }),
  );

  const protect = [isAuthenticated, isAllowed(config.auth.providers[0].authorization)];

  app.use('/auth', createAuthRoutes(registry));
  app.use('/', ...protect, createDashboardRoutes(monitor, config.services));
  app.use('/', ...protect, createWakeRoutes(monitor, config.services));
  app.use('/', ...protect, createSseRoutes(monitor));

  return app;
}
```

Note: `protect` uses `config.auth.providers[0].authorization` — this assumes a single-provider setup. For multi-provider with different authorization rules, the middleware would need the provider from the session. Since the config schema puts `authorization` per-provider and the session stores the provider name, refine the protect middleware:

Actually, the cleaner approach is to check authorization against the provider that was used to log in. Update the `protect` array:

```ts
const protect = [
  isAuthenticated,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const providerName = req.session.user!.provider;
    const providerConfig = config.auth.providers.find((p) => p.name === providerName);
    if (!providerConfig) {
      res.status(403).render('denied');
      return;
    }
    isAllowed(providerConfig.authorization)(req, res, next);
  },
];
```

Full file:

```ts
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './config.js';
import type { ProviderRegistry } from './auth/oidc.js';
import { isAuthenticated, isAllowed } from './auth/middleware.js';
import { Monitor } from './monitor/monitor.js';
import { createAuthRoutes } from './routes/auth.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createWakeRoutes } from './routes/wake.js';
import { createSseRoutes } from './routes/sse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(config: AppConfig, monitor: Monitor, registry: ProviderRegistry): express.Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      secret: config.server.sessionSecret,
      resave: false,
      saveUninitialized: false,
    }),
  );

  const protect: express.RequestHandler[] = [
    isAuthenticated,
    (req, res, next) => {
      const providerName = req.session.user!.provider;
      const providerConfig = config.auth.providers.find((p) => p.name === providerName);
      if (!providerConfig) {
        res.status(403).render('denied');
        return;
      }
      isAllowed(providerConfig.authorization)(req, res, next);
    },
  ];

  app.use('/auth', createAuthRoutes(registry));
  app.use('/', ...protect, createDashboardRoutes(monitor, config.services));
  app.use('/', ...protect, createWakeRoutes(monitor, config.services));
  app.use('/', ...protect, createSseRoutes(monitor));

  return app;
}
```

- [ ] **Step 2: Rewrite `src/index.ts`**

```ts
import { loadConfig } from './config.js';
import { createApp } from './server.js';
import { Monitor } from './monitor/monitor.js';
import { initProviders } from './auth/oidc.js';
import { logger } from './logger.js';

const configPath = process.env.CONFIG_PATH || './config.yaml';

async function main() {
  const config = loadConfig(configPath);

  const registry = await initProviders(config.auth.providers, config.auth.callbackBaseUrl);
  logger.info('OIDC providers discovered', { providers: config.auth.providers.map((p) => p.name) });

  const monitor = new Monitor(config.services, config.polling.intervalSeconds);
  monitor.start();

  const app = createApp(config, monitor, registry);

  app.listen(config.server.port, () => {
    logger.info(`Wakenerr running on port ${config.server.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start Wakenerr:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: Some tests in routes may fail due to changed `createApp` signature — fix in next step.

- [ ] **Step 4: Fix any callers of `createApp` in tests**

Grep for `createApp` in tests. If `tests/routes/dashboard.test.ts`, `sse.test.ts`, or `wake.test.ts` import `createApp`, they need a mock registry parameter. More likely they create their own Express app with just the route — check and fix as needed.

Run: `grep -rn "createApp" tests/`

If any test uses `createApp`, add a dummy registry (empty Map) as the third argument.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat(auth): wire OIDC registry into server, drop passport init"
```

---

### Task 5: Delete Passport, Update `global.d.ts`, Update Login View

**Files:**
- Delete: `src/auth/passport.ts`
- Modify: `src/global.d.ts`
- Modify: `src/views/login.ejs`

- [ ] **Step 1: Delete `src/auth/passport.ts`**

```bash
rm src/auth/passport.ts
```

- [ ] **Step 2: Replace `src/global.d.ts`**

The `passport-microsoft` declare is no longer needed. Replace with session augmentation if not already in middleware (it is — the `declare module 'express-session'` block is in `middleware.ts`). Just delete the content:

```ts
export {};
```

- [ ] **Step 3: Update `src/views/login.ejs`**

The view already uses a `providers` array and renders `provider.charAt(0).toUpperCase() + provider.slice(1)`. The only change: provider values are now names (e.g. `"authelia"`) instead of types. The template already handles this correctly — the link href `/auth/<%= provider %>` will map to the dynamic route. No changes needed to the template logic.

Verify by reading it — no modifications required.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git rm src/auth/passport.ts
git add src/global.d.ts
git commit -m "refactor(auth): remove passport strategy file and stale type declarations"
```

---

### Task 6: Remove Passport Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall passport packages**

```bash
npm uninstall passport passport-google-oauth20 passport-microsoft @types/passport @types/passport-google-oauth20
```

(Some may not be listed — that's fine, npm ignores missing packages in uninstall.)

- [ ] **Step 2: Verify no remaining passport imports**

```bash
grep -rn "passport" src/ tests/
```

Expected: no matches

- [ ] **Step 3: Run full test suite and type check**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: PASS, no type errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove passport dependencies"
```

---

### Task 7: Update `src/config.ts` — Remove `allowedEmails` from Top Level

**Files:**
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Check current config schema**

The config schema currently has `allowedEmails` as a top-level property under `auth` (per CLAUDE.md). Check if it still does:

```bash
grep -n "allowedEmails" src/config.ts
```

Looking at the current `config.ts`, `allowedEmails` is inside the `authorizationSchema` which is nested in `providerSchema`. The top-level `auth` object has `providers` and `callbackBaseUrl` only. So the schema is already correct — `allowedEmails` lives per-provider in `authorization`.

However, `src/server.ts` previously referenced `config.auth.allowedEmails` — we already removed that in Task 4.

Check `tests/config.test.ts` to see if it references the old shape:

```bash
grep -n "allowedEmails" tests/config.test.ts
```

Update any test fixtures to use the new provider-based `authorization` shape if they still use the old top-level `allowedEmails`.

- [ ] **Step 2: Run config tests**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add tests/config.test.ts
git commit -m "test: update config tests for per-provider authorization schema"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Start dev server (manual smoke test)**

```bash
npm run dev
```

Verify it starts without errors. If no real OIDC provider is configured, it will fail at discovery — that's expected. The code path is correct.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: Clean build to `dist/`
