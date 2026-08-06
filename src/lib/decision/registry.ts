import type { DecisionStrategy } from './interfaces.js';

class DecisionRegistry {
  private strategies: Map<string, DecisionStrategy> = new Map();

  register(strategy: DecisionStrategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(`[DecisionRegistry] Overwriting existing strategy with ID: ${strategy.id}`);
    }
    this.strategies.set(strategy.id, strategy);
    console.log(`[DecisionRegistry] Registered strategy: ${strategy.name} (${strategy.id})`);
  }

  get(id: string): DecisionStrategy | undefined {
    return this.strategies.get(id);
  }

  getAll(): DecisionStrategy[] {
    return Array.from(this.strategies.values()).sort((a, b) => b.priority() - a.priority());
  }

  clear(): void {
    this.strategies.clear();
  }
}

export const decisionRegistry = new DecisionRegistry();
