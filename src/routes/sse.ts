import { Router } from 'express';
import type { Monitor } from '../monitor/monitor.js';

export function createSseRoutes(monitor: Monitor): Router {
  return Router();
}
