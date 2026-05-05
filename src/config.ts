import { z } from 'zod';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

const providerSchema = z.object({
  type: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  tenantId: z.string().optional(),
});

const serviceSchema = z.object({
  name: z.string(),
  host: z.string(),
  mac: z.string().regex(macRegex, 'Invalid MAC address format'),
  url: z.string().url(),
});

export const configSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    sessionSecret: z.string(),
  }),
  auth: z.object({
    providers: z.array(providerSchema).min(1),
    callbackBaseUrl: z.string().url(),
    allowedEmails: z.array(z.string().email()),
  }),
  services: z.array(serviceSchema).min(1),
  polling: z.object({
    intervalSeconds: z.number().default(30),
  }).default({ intervalSeconds: 30 }),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf-8');
  const parsed = yaml.load(raw);
  return configSchema.parse(parsed);
}
