import { Router } from 'express';
import type { Monitor } from '../monitor/monitor.js';

export function createSseRoutes(monitor: Monitor): Router {
  const router = Router();

  router.get('/sse/all', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const statuses = monitor.getAllStatuses();
    res.write(`data: ${JSON.stringify({ type: 'init', statuses })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    const onStatusChange = (name: string, status: string) => {
      res.write(`data: ${JSON.stringify({ type: 'update', name, status })}\n\n`);
    };

    monitor.on('statusChange', onStatusChange);
    req.on('close', () => {
      clearInterval(heartbeat);
      monitor.off('statusChange', onStatusChange);
    });
  });

  router.get('/sse/:service', (req, res) => {
    const serviceName = req.params.service;
    const status = monitor.getStatus(serviceName);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify({ type: 'status', name: serviceName, status })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    const onStatusChange = (name: string, newStatus: string) => {
      if (name === serviceName) {
        res.write(`data: ${JSON.stringify({ type: 'status', name, status: newStatus })}\n\n`);
      }
    };

    monitor.on('statusChange', onStatusChange);
    req.on('close', () => {
      clearInterval(heartbeat);
      monitor.off('statusChange', onStatusChange);
    });
  });

  return router;
}
