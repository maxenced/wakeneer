import { Router } from 'express';
import type { Monitor } from '../monitor/monitor.js';

export function createDashboardRoutes(monitor: Monitor, services: any[]): Router {
  return Router();
}
