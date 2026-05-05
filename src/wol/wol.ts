import wol from 'wake_on_lan';
import { logger } from '../logger.js';

export function sendWol(mac: string): Promise<void> {
  const opts = { address: '255.255.255.255' };
  logger.debug('Sending WoL magic packet', { mac, broadcast: opts.address });
  return new Promise((resolve, reject) => {
    wol.wake(mac, opts, (err: Error | null) => {
      if (err) {
        logger.error('WoL packet failed', { mac, error: err.message });
        reject(err);
      } else {
        logger.debug('WoL packet sent successfully', { mac });
        resolve();
      }
    });
  });
}
