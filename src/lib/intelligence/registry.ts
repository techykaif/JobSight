import type { DiscoveryAnalyzer } from './interfaces.js';

class DiscoveryAnalyzerRegistry {
  private analyzers: Map<string, DiscoveryAnalyzer> = new Map();

  register(analyzer: DiscoveryAnalyzer): void {
    if (this.analyzers.has(analyzer.id)) {
      console.warn(`[AnalyzerRegistry] Overwriting existing analyzer with ID: ${analyzer.id}`);
    }
    this.analyzers.set(analyzer.id, analyzer);
    console.log(`[AnalyzerRegistry] Registered analyzer: ${analyzer.name} (${analyzer.id})`);
  }

  get(id: string): DiscoveryAnalyzer | undefined {
    return this.analyzers.get(id);
  }

  getAll(): DiscoveryAnalyzer[] {
    return Array.from(this.analyzers.values());
  }

  clear(): void {
    this.analyzers.clear();
  }
}

export const analyzerRegistry = new DiscoveryAnalyzerRegistry();
