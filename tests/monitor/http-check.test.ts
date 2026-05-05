import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHttp } from '../../src/monitor/http-check.js';

describe('checkHttp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when URL responds with 2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('OK', { status: 200 }));
    const result = await checkHttp('http://example.com');
    expect(result).toBe(true);
  });

  it('returns true for 3xx redirects', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 302 }));
    const result = await checkHttp('http://example.com');
    expect(result).toBe(true);
  });

  it('returns false for 5xx errors', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('Error', { status: 500 }));
    const result = await checkHttp('http://example.com');
    expect(result).toBe(false);
  });

  it('returns false when fetch throws (network error)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkHttp('http://example.com');
    expect(result).toBe(false);
  });

  it('returns false when request times out', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 100))
    );
    const result = await checkHttp('http://example.com', 0.05);
    expect(result).toBe(false);
  });
});
