export interface DiscoverySourceTarget {
  url: string;
  type: string; // e.g. 'GREENHOUSE', 'SEARCH_ENGINE'
  weight?: number;
}

export interface StrategyConfiguration {
  maxUsableOpportunities: number;
  maxBudgetMs: number;
  maxProviderRuntimeMs: number;
}

export interface DiscoveryStrategy {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  // Weight and order the available sources
  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[];

  // Evaluate if discovery should stop
  shouldTerminateEarly(metrics: {
    elapsedMs: number;
    usableFound: number;
    providersExhausted: boolean;
  }, config: StrategyConfiguration): { terminate: boolean; reason?: string };

  // Generate configurations specific to this strategy
  getConfiguration(huntConfig?: any): StrategyConfiguration;
}
