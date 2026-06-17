import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { createWakeRoutes } from '../../src/routes/wake.js';

vi.mock('../../src/wol/wol.js', () => ({
  sendWol: vi.fn().mockResolvedValue(undefined),
}));

import { sendWol } from '../../src/wol/wol.js';

const mockMonitor = {
  getStatus: vi.fn().mockReturnValue('down'),
  triggerWake: vi.fn(),
};

const services = [
  { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://192.168.1.10:32400' },
];

describe('wake routes', () => {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'src/views'));
  app.use(express.urlencoded({ extended: false }));
  app.use('/', createWakeRoutes(mockMonitor as any, services));

  it('POST /wake/:service sends WoL and redirects to wait page', async () => {
    const res = await request(app).post('/wake/Plex');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wait/Plex');
    expect(sendWol).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
  });

  it('POST /wake/:service skips WoL if already ready', async () => {
    vi.mocked(mockMonitor.getStatus).mockReturnValue('ready');
    vi.mocked(sendWol).mockClear();
    const res = await request(app).post('/wake/Plex');
    expect(res.status).toBe(302);
    expect(sendWol).not.toHaveBeenCalled();
  });

  it('POST /wake/:unknownService returns 404', async () => {
    const res = await request(app).post('/wake/Unknown');
    expect(res.status).toBe(404);
  });

  it('GET /wait/:service renders the wait page', async () => {
    const res = await request(app).get('/wait/Plex');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Plex');
  });
});
