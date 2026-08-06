import { registerCoreProviders } from './discovery/providers/index.js';
import { registerCoreStrategies as registerCoreDiscoveryStrategies } from './discovery/strategy/index.js';
import { registerCoreAnalyzers } from './intelligence/analyzers/index.js';
import { registerCoreStrategies as registerCoreDecisionStrategies } from './decision/engine.js';

let bootstrapped = false;

export function bootstrap() {
  if (bootstrapped) {
    return;
  }

  console.log('[Bootstrap] Initializing Application Registries...');

  // 1. Providers (HOW we discover)
  registerCoreProviders();

  // 2. Discovery Strategies (WHERE we discover)
  registerCoreDiscoveryStrategies();

  // 3. Discovery Analyzers (HOW we evaluate)
  registerCoreAnalyzers();

  // 4. Decision Strategies (WHAT we recommend)
  registerCoreDecisionStrategies();

  bootstrapped = true;
  console.log('[Bootstrap] Application Registries Initialized Successfully.');
}
