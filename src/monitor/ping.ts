import pkg from 'ping';
import { logger } from '../logger.js';
const { promise: pingPromise } = pkg;

export async function pingHost(host: string, timeoutSeconds = 3): Promise<boolean> {
  try {
    const result = await pingPromise.probe(host, { timeout: timeoutSeconds });
    logger.debug('Ping check', { host, alive: result.alive, time: result.time });
    return result.alive;
  } catch (err) {
    logger.debug('Ping check failed', { host, error: (err as Error).message });
    return false;
  }
}
