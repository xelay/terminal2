import { ExchangeAdapter } from './types';
import { BybitAdapter } from './adapters/BybitAdapter';
import { MoexAdapter } from './adapters/MoexAdapter';

class ExchangeService {
  private adapters = new Map<string, ExchangeAdapter>();

  constructor() {
    this.registerAdapter(new BybitAdapter());
    this.registerAdapter(new MoexAdapter());
  }

  private registerAdapter(adapter: ExchangeAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(exchangeId: string): ExchangeAdapter {
    const adapter = this.adapters.get(exchangeId);
    if (!adapter) throw new Error(`Exchange adapter '${exchangeId}' not found`);
    return adapter;
  }
}

export const exchangeService = new ExchangeService();
