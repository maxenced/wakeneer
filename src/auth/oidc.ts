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
        token_endpoint_auth_method: providerConfig.tokenEndpointAuthMethod,
      });
      return { name: providerConfig.name, client, config: providerConfig };
    }),
  );

  for (const { name, client, config } of results) {
    registry.set(name, { client, config });
  }

  return registry;
}
