import { describe, it, expect } from 'vitest';
import { configSchema } from '../src/config.js';

describe('configSchema', () => {
  it('validates a complete valid config', () => {
    const valid = {
      server: { port: 3000, sessionSecret: 'secret' },
      auth: {
        providers: [
          { type: 'google', clientId: 'id', clientSecret: 'secret' },
        ],
        callbackBaseUrl: 'http://localhost:3000',
        allowedEmails: ['user@example.com'],
      },
      services: [
        { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://192.168.1.10:32400' },
      ],
      polling: { intervalSeconds: 30 },
    };
    const result = configSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects config with missing services', () => {
    const invalid = {
      server: { port: 3000, sessionSecret: 'secret' },
      auth: {
        providers: [{ type: 'google', clientId: 'id', clientSecret: 'secret' }],
        callbackBaseUrl: 'http://localhost:3000',
        allowedEmails: ['user@example.com'],
      },
      polling: { intervalSeconds: 30 },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid MAC address format', () => {
    const invalid = {
      server: { port: 3000, sessionSecret: 'secret' },
      auth: {
        providers: [{ type: 'google', clientId: 'id', clientSecret: 'secret' }],
        callbackBaseUrl: 'http://localhost:3000',
        allowedEmails: ['user@example.com'],
      },
      services: [
        { name: 'Plex', host: '192.168.1.10', mac: 'not-a-mac', url: 'http://example.com' },
      ],
      polling: { intervalSeconds: 30 },
    };
    const result = configSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('uses default polling interval when omitted', () => {
    const config = {
      server: { port: 3000, sessionSecret: 'secret' },
      auth: {
        providers: [{ type: 'google', clientId: 'id', clientSecret: 'secret' }],
        callbackBaseUrl: 'http://localhost:3000',
        allowedEmails: ['user@example.com'],
      },
      services: [
        { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://example.com' },
      ],
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.polling.intervalSeconds).toBe(30);
    }
  });
});

import { loadConfig } from '../src/config.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  it('loads and validates a YAML file', () => {
    const configPath = join(tmpdir(), 'test-config.yaml');
    const content = `
server:
  port: 3000
  sessionSecret: "test-secret"
auth:
  providers:
    - type: google
      clientId: test-id
      clientSecret: test-secret
  callbackBaseUrl: "http://localhost:3000"
  allowedEmails:
    - "user@example.com"
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
    expect(config.services[0].name).toBe('Plex');
    expect(config.polling.intervalSeconds).toBe(15);
    unlinkSync(configPath);
  });

  it('throws on missing file', () => {
    expect(() => loadConfig('/nonexistent.yaml')).toThrow();
  });
});
