import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Monitor, ServiceStatus } from '../../src/monitor/monitor.js';

vi.mock('../../src/monitor/ping.js', () => ({
  pingHost: vi.fn(),
}));
vi.mock('../../src/monitor/http-check.js', () => ({
  checkHttp: vi.fn(),
}));

import { pingHost } from '../../src/monitor/ping.js';
import { checkHttp } from '../../src/monitor/http-check.js';

const services = [
  { name: 'Plex', host: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF', url: 'http://192.168.1.10:32400' },
  { name: 'Cloud', host: '192.168.1.11', mac: '11:22:33:44:55:66', url: 'http://192.168.1.11:8080' },
];

describe('Monitor', () => {
  let monitor: Monitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new Monitor(services, 30);
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it('initializes all services as "down"', () => {
    expect(monitor.getStatus('Plex')).toBe('down');
    expect(monitor.getStatus('Cloud')).toBe('down');
  });

  it('sets status to "ready" when ping and http both succeed', async () => {
    vi.mocked(pingHost).mockResolvedValue(true);
    vi.mocked(checkHttp).mockResolvedValue(true);
    await monitor.checkAll();
    expect(monitor.getStatus('Plex')).toBe('ready');
  });

  it('sets status to "starting" when ping succeeds but http fails', async () => {
    vi.mocked(pingHost).mockResolvedValue(true);
    vi.mocked(checkHttp).mockResolvedValue(false);
    await monitor.checkAll();
    expect(monitor.getStatus('Plex')).toBe('starting');
  });

  it('sets status to "down" when ping fails', async () => {
    vi.mocked(pingHost).mockResolvedValue(false);
    vi.mocked(checkHttp).mockResolvedValue(false);
    await monitor.checkAll();
    expect(monitor.getStatus('Plex')).toBe('down');
  });

  it('emits status change events', async () => {
    const changes: Array<{ name: string; status: ServiceStatus }> = [];
    monitor.on('statusChange', (name, status) => changes.push({ name, status }));

    vi.mocked(pingHost).mockResolvedValue(true);
    vi.mocked(checkHttp).mockResolvedValue(true);
    await monitor.checkAll();

    expect(changes).toContainEqual({ name: 'Plex', status: 'ready' });
    expect(changes).toContainEqual({ name: 'Cloud', status: 'ready' });
  });

  it('does not emit event when status unchanged', async () => {
    vi.mocked(pingHost).mockResolvedValue(false);
    vi.mocked(checkHttp).mockResolvedValue(false);

    await monitor.checkAll();
    const changes: Array<{ name: string; status: ServiceStatus }> = [];
    monitor.on('statusChange', (name, status) => changes.push({ name, status }));
    await monitor.checkAll();

    expect(changes).toHaveLength(0);
  });

  it('enters aggressive polling when transitioning to "starting"', async () => {
    vi.mocked(pingHost).mockResolvedValue(true);
    vi.mocked(checkHttp).mockResolvedValue(false);
    await monitor.checkAll();
    expect(monitor.isInRetryWindow('Plex')).toBe(true);
  });

  it('exits retry window after 60 seconds', async () => {
    vi.mocked(pingHost).mockResolvedValue(true);
    vi.mocked(checkHttp).mockResolvedValue(false);
    await monitor.checkAll();
    expect(monitor.isInRetryWindow('Plex')).toBe(true);

    vi.advanceTimersByTime(61000);
    expect(monitor.isInRetryWindow('Plex')).toBe(false);
  });
});
