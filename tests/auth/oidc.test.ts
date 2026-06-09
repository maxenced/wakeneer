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
  Client: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
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
