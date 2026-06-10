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

vi.mock('openid-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openid-client')>();
  return {
    ...actual,
    generators: {
      state: () => 'mock-state',
      nonce: () => 'mock-nonce',
      codeVerifier: () => 'mock-code-verifier',
      codeChallenge: () => 'mock-code-challenge',
    },
  };
});

function createTestApp(registry: ProviderRegistry) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', 'src/views');
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/auth', createAuthRoutes(registry, 'http://localhost:3000'));
  return app;
}

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
