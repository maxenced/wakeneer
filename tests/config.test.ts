import { describe, it, expect } from 'vitest';
import { configSchema } from '../src/config.js';
import { loadConfig } from '../src/config.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const baseServices = [
  { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://192.168.1.10:32400' },
];

const baseProvider = {
  name: 'company',
  discoveryUrl: 'https://sso.company.com',
  clientId: 'id',
  clientSecret: 'secret',
  authorization: { allowedEmails: ['user@example.com'] },
};

describe('configSchema', () => {
  it('accepts a provider with only allowedEmails', () => {
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [baseProvider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a provider with only allowedClaim', () => {
    const provider = {
      ...baseProvider,
      authorization: { allowedClaim: { name: 'groups', values: ['admins'] } },
    };
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [provider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a provider with both allowedEmails and allowedClaim', () => {
    const provider = {
      ...baseProvider,
      authorization: {
        allowedEmails: ['user@example.com'],
        allowedClaim: { name: 'groups', values: ['admins'] },
      },
    };
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [provider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a provider with neither allowedEmails nor allowedClaim', () => {
    const provider = { ...baseProvider, authorization: {} };
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [provider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a provider missing discoveryUrl', () => {
    const { discoveryUrl: _, ...providerNoUrl } = baseProvider;
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [providerNoUrl], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(false);
  });

  it('uses default scopes when omitted', () => {
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [baseProvider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth.providers[0].scopes).toEqual(['openid', 'email', 'profile']);
    }
  });

  it('rejects config with missing services', () => {
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [baseProvider], callbackBaseUrl: 'http://localhost:3000' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid MAC address format', () => {
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [baseProvider], callbackBaseUrl: 'http://localhost:3000' },
      services: [{ name: 'Plex', host: '192.168.1.10', mac: 'not-a-mac', url: 'http://example.com' }],
    });
    expect(result.success).toBe(false);
  });

  it('uses default polling interval when omitted', () => {
    const result = configSchema.safeParse({
      server: { port: 3000, sessionSecret: 'secret' },
      auth: { providers: [baseProvider], callbackBaseUrl: 'http://localhost:3000' },
      services: baseServices,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.polling.intervalSeconds).toBe(30);
    }
  });
});

describe('loadConfig', () => {
  it('loads and validates a YAML file', () => {
    const configPath = join(tmpdir(), 'test-config.yaml');
    const content = `
server:
  port: 3000
  sessionSecret: "test-secret"
auth:
  providers:
    - name: company
      discoveryUrl: "https://sso.company.com"
      clientId: test-id
      clientSecret: test-secret
      authorization:
        allowedEmails:
          - "user@example.com"
  callbackBaseUrl: "http://localhost:3000"
services:
  - name: Plex
    host: "192.168.1.10"
    mac: "AA:BB:CC:DD:EE:FF"
    url: "http://192.168.1.10:32400"
polling:
  intervalSeconds: 15
`;
    writeFileSync(configPath, content);
    const config = loadConfig(configPath);
    expect(config.server.port).toBe(3000);
    expect(config.auth.providers[0].name).toBe('company');
    expect(config.polling.intervalSeconds).toBe(15);
    unlinkSync(configPath);
  });

  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent.yaml')).toThrow();
  });
});
