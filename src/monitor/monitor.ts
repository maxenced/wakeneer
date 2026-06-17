import { EventEmitter } from 'node:events';
import { pingHost } from './ping.js';
import { checkHttp } from './http-check.js';
import { logger } from '../logger.js';

export type ServiceStatus = 'down' | 'starting' | 'ready';

interface ServiceConfig {
  name: string;
  host: string;
  mac: string;
  url: string;
}

interface ServiceState {
  status: ServiceStatus;
  retryWindowStart: number | null;
  checking: boolean;
}

const RETRY_WINDOW_MS = 60_000;
const RETRY_INTERVAL_MS = 5_000;

export class Monitor extends EventEmitter {
  private services: ServiceConfig[];
  private states: Map<string, ServiceState> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private retryIntervalId: ReturnType<typeof setInterval> | null = null;
  private pollingIntervalMs: number;

  constructor(services: ServiceConfig[], pollingIntervalSeconds: number) {
    super();
    this.services = services;
    this.pollingIntervalMs = pollingIntervalSeconds * 1000;
    for (const service of services) {
      this.states.set(service.name, { status: 'down', retryWindowStart: null, checking: false });
    }
  }

  start(): void {
    this.checkAll();
    this.intervalId = setInterval(() => this.checkAll(), this.pollingIntervalMs);
    this.retryIntervalId = setInterval(() => this.checkRetrying(), RETRY_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.retryIntervalId) clearInterval(this.retryIntervalId);
  }

  getStatus(name: string): ServiceStatus {
    return this.states.get(name)?.status ?? 'down';
  }

  getAllStatuses(): Array<{ name: string; status: ServiceStatus }> {
    return this.services.map((s) => ({ name: s.name, status: this.getStatus(s.name) }));
  }

  triggerWake(name: string): void {
    const state = this.states.get(name);
    if (!state) return;
    state.retryWindowStart = Date.now();
    logger.info('Wake triggered, starting aggressive polling', { service: name });
    const service = this.services.find((s) => s.name === name);
    if (service) this.checkService(service);
  }

  isInRetryWindow(name: string): boolean {
    const state = this.states.get(name);
    if (!state || state.retryWindowStart === null) return false;
    return Date.now() - state.retryWindowStart < RETRY_WINDOW_MS;
  }

  async checkAll(): Promise<void> {
    await Promise.all(this.services.map((service) => this.checkService(service)));
  }

  private async checkRetrying(): Promise<void> {
    const retrying = this.services.filter((s) => this.isInRetryWindow(s.name));
    await Promise.all(retrying.map((service) => this.checkService(service)));
  }

  private async checkService(service: ServiceConfig): Promise<void> {
    const state = this.states.get(service.name)!;
    if (state.checking) return;
    state.checking = true;

    try {
      await this.doCheck(service, state);
    } finally {
      state.checking = false;
    }
  }

  private async doCheck(service: ServiceConfig, state: ServiceState): Promise<void> {
    const pingOk = await pingHost(service.host);

    let newStatus: ServiceStatus;
    if (!pingOk) {
      newStatus = 'down';
    } else {
      const httpOk = await checkHttp(service.url);
      newStatus = httpOk ? 'ready' : 'starting';
    }

    if (newStatus === 'starting' && state.status === 'down') {
      state.retryWindowStart = Date.now();
    }
    if (newStatus === 'ready' || newStatus === 'down') {
      state.retryWindowStart = null;
    }

    if (newStatus !== state.status) {
      logger.info('Service status changed', { service: service.name, from: state.status, to: newStatus });
      state.status = newStatus;
      this.emit('statusChange', service.name, newStatus);
    }
  }
}
