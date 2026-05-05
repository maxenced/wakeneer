import { Router } from 'express';
import type { Monitor } from '../monitor/monitor.js';
import { sendWol } from '../wol/wol.js';
import { logger } from '../logger.js';

interface ServiceConfig {
  name: string;
  host: string;
  mac: string;
  url: string;
}

export function createWakeRoutes(monitor: Monitor, services: ServiceConfig[]): Router {
  const router = Router();

  router.post('/wake/:service', async (req, res) => {
    const service = services.find((s) => s.name === req.params.service);
    if (!service) {
      res.status(404).send('Service not found');
      return;
    }
    const user = (req as any).user;
    const status = monitor.getStatus(service.name);
    if (status !== 'ready') {
      logger.info('Wake triggered', { service: service.name, by: user?.email });
      await sendWol(service.mac);
    }
    res.redirect(`/wait/${service.name}`);
  });

  router.get('/wait/:service', (req, res) => {
    const service = services.find((s) => s.name === req.params.service);
    if (!service) {
      res.status(404).send('Service not found');
      return;
    }
    const status = monitor.getStatus(service.name);
    res.render('wait', { service, status });
  });

  return router;
}
