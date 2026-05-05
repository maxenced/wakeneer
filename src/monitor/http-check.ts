import { logger } from '../logger.js';

export async function checkHttp(url: string, timeoutSeconds = 5): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(timeout);
    const ok = response.status < 400;
    logger.debug('HTTP check', { url, status: response.status, ok });
    return ok;
  } catch (err) {
    logger.debug('HTTP check failed', { url, error: (err as Error).message });
    return false;
  }
}
