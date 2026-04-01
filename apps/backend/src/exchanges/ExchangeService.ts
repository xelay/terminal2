import { ExchangeAdapter, SymbolResult } from './types';
import { BybitAdapter } from './adapters/BybitAdapter';
// import { MoexAdapter } from './adapters/MoexAdapter'; // disabled: noisy logs, bad data
import { TinkoffAdapter } from './adapters/TinkoffAdapter';

class ExchangeService {
  private adapters = new Map<string, ExchangeAdapter>();

  constructor() {
    this.registerAdapter(new BybitAdapter());
    // this.registerAdapter(new MoexAdapter()); // disabled
    this.registerAdapter(new TinkoffAdapter());
  }

  private registerAdapter(adapter: ExchangeAdapter) {
    this.adapters.set(adapter.id, adapter);
    console.log(`[ExchangeService] registered adapter: ${adapter.id}`);
  }

  getAdapter(exchangeId: string): ExchangeAdapter {
    const adapter = this.adapters.get(exchangeId);
    if (!adapter) throw new Error(`Exchange adapter '${exchangeId}' not found`);
    return adapter;
  }

  /** Параллельный поиск по всем активным адаптерам */
  async searchAll(query: string): Promise<SymbolResult[]> {
    const adapters = [...this.adapters.values()];
    console.log(`[ExchangeService] searchAll "${query}" — adapters: [${adapters.map(a => a.id).join(', ')}]`);

    const results = await Promise.allSettled(
      adapters.map(a =>
        a.searchSymbols(query)
          .then(r => {
            console.log(`[ExchangeService] ${a.id}.searchSymbols("${query}") => ${r.length} results`);
            return r;
          })
          .catch(e => {
            console.error(`[ExchangeService] ${a.id}.searchSymbols("${query}") THREW:`, e.message);
            throw e;
          })
      )
    );

    const combined = results
      .map((r, i) => {
        if (r.status === 'rejected') {
          console.warn(`[ExchangeService] adapter ${adapters[i].id} rejected:`, r.reason?.message);
          return [];
        }
        return r.value;
      })
      .flat();

    console.log(`[ExchangeService] searchAll "${query}" total: ${combined.length} results`);
    return combined;
  }
}

export const exchangeService = new ExchangeService();
