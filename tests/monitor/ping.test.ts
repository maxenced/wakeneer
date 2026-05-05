import { describe, it, expect, vi } from 'vitest';
import { pingHost } from '../../src/monitor/ping.js';

vi.mock('ping', () => ({
  default: {
    promise: {
      probe: vi.fn(),
    },
  },
  promise: {
    probe: vi.fn(),
  },
}));

import pkg from 'ping';
const pingPromise = pkg.promise;

describe('pingHost', () => {
  it('returns true when host is reachable', async () => {
    vi.mocked(pingPromise.probe).mockResolvedValue({
      alive: true,
      host: '192.168.1.10',
      output: '',
      time: 1,
      min: '1',
      max: '1',
      avg: '1',
      stddev: '0',
      packetLoss: '0',
      numeric_host: '192.168.1.10',
    });
    const result = await pingHost('192.168.1.10');
    expect(result).toBe(true);
  });

  it('returns false when host is unreachable', async () => {
    vi.mocked(pingPromise.probe).mockResolvedValue({
      alive: false,
      host: '192.168.1.10',
      output: '',
      time: 'unknown',
      min: 'unknown',
      max: 'unknown',
      avg: 'unknown',
      stddev: 'unknown',
      packetLoss: '100',
      numeric_host: '192.168.1.10',
    });
    const result = await pingHost('192.168.1.10');
    expect(result).toBe(false);
  });

  it('returns false when ping throws', async () => {
    vi.mocked(pingPromise.probe).mockRejectedValue(new Error('timeout'));
    const result = await pingHost('192.168.1.10');
    expect(result).toBe(false);
  });
});
