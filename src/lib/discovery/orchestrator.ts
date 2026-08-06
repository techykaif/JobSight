import crypto from 'crypto';
import * as repos from '../db/repositories/index.js';
import { providerRegistry } from './registry.js';
import type { DiscoveryContext, DiscoveryResult, DiscoveredJob } from './interfaces.js';
import { registerCoreProviders } from './providers/index.js';

import { registerCoreStrategies, strategyRegistry } from './strategy/index.js';

// Ensure providers and strategies are registered
registerCoreProviders();
registerCoreStrategies();

export async function runDiscovery(runId: string, config: any, abortSignal?: AbortSignal): Promise<{ jobs: DiscoveredJob[], unstructuredText: string }> {
  console.log(`[Discovery] Starting discovery for run ${runId}`);
  
  // 1. Resolve Strategy
  const strategyName = config.discoveryStrategy || 'strategy_default';
  const strategy = strategyRegistry.get(strategyName) || strategyRegistry.get('strategy_default')!;
  
  console.log(`[Discovery] Using strategy: ${strategy.name}`);
  const strategyConfig = strategy.getConfiguration();

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'STRATEGY_STARTED',
    stage: 'DISCOVERY',
    payload: { strategy: strategy.name, budget: strategyConfig.maxBudgetMs }
  });

  // 2. Resolve Sources
  let baseSources = config.discoverySources || [
    { url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' },
    { url: 'https://boards.greenhouse.io/test', type: 'GREENHOUSE' },
    { url: 'https://jobs.lever.co/test', type: 'LEVER' },
    { url: 'https://example.com/careers', type: 'CAREERS_PAGE' }
  ];

  // 3. Prioritize Sources via Strategy
  const prioritizedSources = strategy.prioritizeSources(baseSources);

  let allJobs: DiscoveredJob[] = [];
  let allUnstructured = '';

  const context: DiscoveryContext = {
    runId,
    sourceUrl: '',
    targetRoles: config.targetRoles || [],
    alternativeRoles: config.alternativeRoles || [],
    location: config.candidateCountry,
    remoteOnly: config.remoteRequirement === 'REMOTE_ONLY'
  };

  const discoveryStartTime = Date.now();
  let earlyTerminated = false;
  let terminationReason = '';

  // 4. Execute Discovery Loop
  for (const source of prioritizedSources) {
    if (abortSignal?.aborted) {
      earlyTerminated = true;
      terminationReason = 'Abort signal received';
      break;
    }

    // Check budget / usable goals BEFORE next source
    const elapsedMs = Date.now() - discoveryStartTime;
    const termCheck = strategy.shouldTerminateEarly({
      elapsedMs,
      usableFound: allJobs.length,
      providersExhausted: false
    }, strategyConfig);

    if (termCheck.terminate) {
      earlyTerminated = true;
      terminationReason = termCheck.reason || 'Terminated by strategy';
      console.log(`[Discovery] Early termination: ${terminationReason}`);
      break;
    }

    const provider = providerRegistry.findProviderForUrl(source.url);
    if (!provider) continue;

    console.log(`[Discovery] Crawling ${source.url} using ${provider.name} (Weight: ${source.weight})`);
    
    // Start measuring this source
    context.sourceUrl = source.url;
    try {
      const result = await provider.discover(context);
      
      if (result.jobs?.length) {
        allJobs.push(...result.jobs.map(j => provider.normalize(j)));
      }
      if (result.unstructuredText) {
        allUnstructured += `\n\n--- Source: ${source.url} ---\n\n` + result.unstructuredText;
      }
    } catch (e: any) {
      console.error(`[Discovery] Error crawling ${source.url}:`, e);
    }
  }

  const finalElapsedMs = Date.now() - discoveryStartTime;

  if (earlyTerminated) {
    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'EARLY_TERMINATION',
      stage: 'DISCOVERY',
      payload: { reason: terminationReason, jobsDiscovered: allJobs.length }
    });
  }

  // Deduplication
  const uniqueJobs = new Map<string, DiscoveredJob>();
  for (const job of allJobs) {
    const key = job.sourceUrl || job.title + job.companyName;
    if (!uniqueJobs.has(key)) uniqueJobs.set(key, job);
  }

  const finalJobs = Array.from(uniqueJobs.values());

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'STRATEGY_COMPLETED',
    stage: 'DISCOVERY',
    payload: { 
      strategy: strategy.name,
      runtime: finalElapsedMs,
      jobsDiscovered: allJobs.length,
      jobsAccepted: finalJobs.length,
      jobsRejected: allJobs.length - finalJobs.length
    }
  });

  return {
    jobs: finalJobs,
    unstructuredText: allUnstructured
  };
}
