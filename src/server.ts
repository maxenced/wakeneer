import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'node:path';
import type { AppConfig } from './config.js';
import { configurePassport } from './auth/passport.js';
import { isAuthenticated, isAllowed } from './auth/middleware.js';
import { Monitor } from './monitor/monitor.js';
import { createAuthRoutes } from './routes/auth.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createWakeRoutes } from './routes/wake.js';
import { createSseRoutes } from './routes/sse.js';

export function createApp(config: AppConfig, monitor: Monitor): express.Express {
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

  app.use(passport.initialize());
  app.use(passport.session());

  configurePassport(config.auth.providers, config.auth.callbackBaseUrl);

  const protect = [isAuthenticated, isAllowed(config.auth.allowedEmails)];

  app.use('/auth', createAuthRoutes(config.auth.providers));
  app.use('/', ...protect, createDashboardRoutes(monitor, config.services));
  app.use('/', ...protect, createWakeRoutes(monitor, config.services));
  app.use('/', ...protect, createSseRoutes(monitor));

  return app;
}
