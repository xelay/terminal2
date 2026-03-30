import { ExchangeAdapter, SymbolResult } from './types';
import { BybitAdapter } from './adapters/BybitAdapter';
import { MoexAdapter } from './adapters/MoexAdapter';
import { TinkoffAdapter } from './adapters/TinkoffAdapter';

class ExchangeService {
  private adapters = new Map<string, ExchangeAdapter>();

  constructor() {
    this.registerAdapter(new BybitAdapter());
    this.registerAdapter(new MoexAdapter());
    this.registerAdapter(new TinkoffAdapter());
  }

  private registerAdapter(adapter: ExchangeAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(exchangeId: string): ExchangeAdapter {
    const adapter = this.adapters.get(exchangeId);
    if (!adapter) throw new Error(`Exchange adapter '${exchangeId}' not found`);
    return adapter;
  }

  /** Параллельный поиск по всем адаптерам */
  async searchAll(query: string): Promise<SymbolResult[]> {
    const adapters = [...this.adapters.values()];
    const results = await Promise.allSettled(
      adapters.map(a => a.searchSymbols(query))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<SymbolResult[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }
}

export const exchangeService = new ExchangeService();
