import type { DiscoveryStrategy } from './interfaces.js';

class DiscoveryStrategyRegistry {
  private strategies: Map<string, DiscoveryStrategy> = new Map();

  register(strategy: DiscoveryStrategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(`[StrategyRegistry] Overwriting existing strategy with ID: ${strategy.id}`);
    }
    this.strategies.set(strategy.id, strategy);
    console.log(`[StrategyRegistry] Registered strategy: ${strategy.name} (${strategy.id})`);
  }

  get(id: string): DiscoveryStrategy | undefined {
    return this.strategies.get(id);
  }

  getAll(): DiscoveryStrategy[] {
    return Array.from(this.strategies.values());
  }

  clear(): void {
    this.strategies.clear();
  }
}

export const strategyRegistry = new DiscoveryStrategyRegistry();
