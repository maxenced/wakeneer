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
