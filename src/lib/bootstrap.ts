import { registerCoreProviders } from './discovery/providers/index.js';
import { registerCoreStrategies as registerCoreDiscoveryStrategies } from './discovery/strategy/index.js';
import { registerCoreAnalyzers } from './intelligence/analyzers/index.js';
import { registerCoreStrategies as registerCoreDecisionStrategies } from './decision/engine.js';
import { foundationRegistry } from './intelligence-foundation/registry.js';
import { registerDefaultProviders } from './intelligence-foundation/providers/signals.js';
import { competitionRegistry } from './competition/registry.js';
import { registerDefaultProviders as registerCompetitionProviders } from './competition/providers/signals.js';
import { companyOpportunityRegistry } from './company-opportunity/registry.js';
import { registerDefaultProviders as registerCompanyOpportunityProviders } from './company-opportunity/providers/signals.js';

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

  // 4. Intelligence Foundation (WHY we recommend)
  registerDefaultProviders(foundationRegistry);

  // 4b. Competition Intelligence
  registerCompetitionProviders(competitionRegistry);

  // 4c. Company Opportunity Intelligence
  registerCompanyOpportunityProviders(companyOpportunityRegistry);

  // 5. Decision Strategies (WHAT we recommend)
  registerCoreDecisionStrategies();

  bootstrapped = true;
  console.log('[Bootstrap] Application Registries Initialized Successfully.');
}
