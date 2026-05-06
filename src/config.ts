import { z } from 'zod';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

const authorizationSchema = z
  .object({
    allowedEmails: z.array(z.string().email()).optional(),
    allowedClaim: z
      .object({
        name: z.string(),
        values: z.array(z.string()).min(1),
      })
      .optional(),
  })
  .refine((data) => data.allowedEmails !== undefined || data.allowedClaim !== undefined, {
    message: 'At least one of allowedEmails or allowedClaim must be provided',
  });

const providerSchema = z.object({
  name: z.string(),
  discoveryUrl: z.string().url(),
  clientId: z.string(),
  clientSecret: z.string(),
  scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
  authorization: authorizationSchema,
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
  }),
  services: z.array(serviceSchema).min(1),
  polling: z
    .object({
      intervalSeconds: z.number().default(30),
    })
    .default({ intervalSeconds: 30 }),
});

export type ProviderConfig = z.infer<typeof providerSchema>;
export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf-8');
  const parsed = yaml.load(raw);
  return configSchema.parse(parsed);
}
