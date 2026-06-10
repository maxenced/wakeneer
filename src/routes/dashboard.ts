import { Router } from 'express';
import type { Monitor } from '../monitor/monitor.js';

interface ServiceConfig {
  name: string;
  host: string;
  mac: string;
  url: string;
}

export function createDashboardRoutes(monitor: Monitor, services: ServiceConfig[]): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const statuses = monitor.getAllStatuses();
    const servicesWithStatus = services.map((s) => ({
      ...s,
      status: statuses.find((st) => st.name === s.name)?.status ?? 'down',
    }));
    res.render('dashboard', { services: servicesWithStatus, user: req.session.user });
  });

  return router;
}
