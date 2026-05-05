import { describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { createSseRoutes } from '../../src/routes/sse.js';

class MockMonitor extends EventEmitter {
  getStatus(name: string) {
    return 'down';
  }
  getAllStatuses() {
    return [{ name: 'Plex', status: 'down' }];
  }
}

describe('SSE routes', () => {
  it('GET /sse/all returns event-stream content type and initial data', async () => {
    const monitor = new MockMonitor();
    const app = express();
    app.use('/', createSseRoutes(monitor as any));
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/sse/all`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString(); });
        setTimeout(() => {
          req.destroy();
          resolve(body);
        }, 50);
      });
      req.on('error', () => {});
    });

    expect(data).toContain('data:');
    expect(data).toContain('"type":"init"');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /sse/:service sends initial status', async () => {
    const monitor = new MockMonitor();
    const app = express();
    app.use('/', createSseRoutes(monitor as any));
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/sse/Plex`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString(); });
        setTimeout(() => {
          req.destroy();
          resolve(body);
        }, 50);
      });
      req.on('error', () => {});
    });

    expect(data).toContain('data:');
    expect(data).toContain('"name":"Plex"');
    expect(data).toContain('"status":"down"');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
