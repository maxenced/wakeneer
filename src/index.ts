import { loadConfig } from './config.js';
import { createApp } from './server.js';
import { Monitor } from './monitor/monitor.js';

const configPath = process.env.CONFIG_PATH || './config.yaml';

try {
  const config = loadConfig(configPath);
  const monitor = new Monitor(config.services, config.polling.intervalSeconds);
  monitor.start();

  const app = createApp(config, monitor);

  app.listen(config.server.port, () => {
    console.log(`Wakenerr running on port ${config.server.port}`);
  });
} catch (err) {
  console.error('Failed to start Wakenerr:', err);
  process.exit(1);
}
