import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import path from 'node:path';
import { createDashboardRoutes } from '../../src/routes/dashboard.js';

const mockMonitor = {
  getAllStatuses: vi.fn().mockReturnValue([
    { name: 'Plex', status: 'ready' },
    { name: 'Cloud', status: 'down' },
  ]),
};

const services = [
  { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://192.168.1.10:32400' },
  { name: 'Cloud', host: '192.168.1.11', mac: '11:22:33:44:55:66', url: 'http://192.168.1.11:8080' },
];

describe('GET /', () => {
  it('renders the dashboard with service statuses', async () => {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(process.cwd(), 'src/views'));
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => { req.session.user = { email: 'a@b.com', displayName: 'A', provider: 'x', claims: {} }; next(); });
    app.use('/', createDashboardRoutes(mockMonitor as any, services));

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Plex');
    expect(res.text).toContain('Cloud');
  });
});
