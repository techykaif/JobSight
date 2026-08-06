import { analyzerRegistry } from '../registry.js';
import { HiddenGemAnalyzer } from './HiddenGemAnalyzer.js';
import { VisibilityAnalyzer } from './VisibilityAnalyzer.js';
import { AuthenticityAnalyzer } from './AuthenticityAnalyzer.js';
import { CompetitionAnalyzer } from './CompetitionAnalyzer.js';
import { FreshnessAnalyzer } from './FreshnessAnalyzer.js';
import { DiscoverySourceAnalyzer } from './DiscoverySourceAnalyzer.js';

export function registerCoreAnalyzers() {
  analyzerRegistry.register(new HiddenGemAnalyzer());
  analyzerRegistry.register(new VisibilityAnalyzer());
  analyzerRegistry.register(new AuthenticityAnalyzer());
  analyzerRegistry.register(new CompetitionAnalyzer());
  analyzerRegistry.register(new FreshnessAnalyzer());
  analyzerRegistry.register(new DiscoverySourceAnalyzer());
}

export {
  HiddenGemAnalyzer,
  VisibilityAnalyzer,
  AuthenticityAnalyzer,
  CompetitionAnalyzer,
  FreshnessAnalyzer,
  DiscoverySourceAnalyzer
};
