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
