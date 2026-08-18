import crypto from 'crypto';
import * as repos from '../db/repositories/index.js';
import { providerRegistry } from './registry.js';
import type { DiscoveryContext, DiscoveryResult, DiscoveredJob } from './interfaces.js';
import { registerCoreProviders } from './providers/index.js';

import { registerCoreStrategies, strategyRegistry } from './strategy/index.js';
import { resolveDiscoverySources, updateSourceHealth } from './source-manager.js';

// Removed auto-registration to support centralized bootstrap

export async function runDiscovery(runId: string, config: any, abortSignal?: AbortSignal): Promise<{ jobs: DiscoveredJob[], unstructuredText: string }> {
  console.log(`[Discovery] Starting discovery for run ${runId}`);
  
  // 1. Resolve Strategy
  // NOTE: strategyRegistry is populated by bootstrap() (see missionManager.start()).
  // A registry miss here (unknown id AND missing default) is a structured,
  // diagnosable failure rather than a bare TypeError - see V1_0_1_A5_2 hotfix.
  const strategyName = config.discoveryStrategy || 'strategy_default';
  const requestedStrategy = strategyRegistry.get(strategyName);
  const fallbackStrategy = requestedStrategy ? undefined : strategyRegistry.get('strategy_default');
  const strategy = requestedStrategy || fallbackStrategy;

  const registeredStrategyIds = strategyRegistry.getAll().map(s => s.id);

  if (!strategy) {
    const message = `[Discovery] Strategy resolution failed: requested '${strategyName}' not found and fallback 'strategy_default' also not found. ` +
      `Registry currently has ${registeredStrategyIds.length} strategies registered (${registeredStrategyIds.join(', ') || 'none'}). ` +
      `This usually means bootstrap() was not called before discovery started.`;
    console.error(message);
    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'STRATEGY_RESOLUTION_FAILED',
      stage: 'DISCOVERY',
      payload: { requestedStrategy: strategyName, registeredStrategyIds }
    });
    throw new Error(message);
  }

  const usedFallbackStrategy = !requestedStrategy;
  console.log(`[Discovery] Using strategy: ${strategy.name} (requested: '${strategyName}'${usedFallbackStrategy ? ', fell back to default' : ''})`);
  const strategyConfig = strategy.getConfiguration(config);

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'STRATEGY_STARTED',
    stage: 'DISCOVERY',
    payload: {
      strategy: strategy.name,
      strategyId: strategy.id,
      requestedStrategyId: strategyName,
      usedFallbackStrategy,
      budget: strategyConfig.maxBudgetMs
    }
  });

  // 2. Resolve Sources (Groups, User URLs, Default fallback)
  const baseSources = await resolveDiscoverySources(config);

  // 3. Prioritize Sources via Strategy
  const prioritizedSources = strategy.prioritizeSources(baseSources);

  // Enforce maximumProviders: cap the source list BEFORE execution so the
  // configured limit is respected deterministically. Priority ordering is
  // preserved — we just take the top N entries.
  const maxProviders = typeof config.maximumProviders === 'number' && config.maximumProviders > 0
    ? config.maximumProviders
    : null;
  const sourcesToExecute = maxProviders !== null
    ? prioritizedSources.slice(0, maxProviders)
    : prioritizedSources;

  if (maxProviders !== null && prioritizedSources.length > maxProviders) {
    console.log(`[Discovery] maximumProviders=${maxProviders}: using ${maxProviders} of ${prioritizedSources.length} resolved sources.`);
  }

  // Resolve which registered provider (if any) will actually handle each
  // source, so telemetry shows resolution results even for sources that
  // never get attempted due to early termination.
  const sourceResolution = prioritizedSources.map(s => {
    const resolvedProvider = providerRegistry.findProviderForUrl(s.url);
    return { url: s.url, requestedType: s.type, resolvedProviderId: resolvedProvider?.id ?? null, resolvedProviderName: resolvedProvider?.name ?? null };
  });
  const unresolvedSources = sourceResolution.filter(s => !s.resolvedProviderId);

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'SOURCE_RESOLUTION_COMPLETED',
    stage: 'DISCOVERY',
    payload: {
      sourcesResolved: sourceResolution.length - unresolvedSources.length,
      sourcesUnresolved: unresolvedSources.length,
      resolvedProviders: [...new Set(sourceResolution.filter(s => s.resolvedProviderId).map(s => s.resolvedProviderName))],
      unresolvedUrls: unresolvedSources.map(s => s.url)
    }
  });

  if (unresolvedSources.length > 0) {
    console.warn(`[Discovery] ${unresolvedSources.length} source(s) had no matching provider and will be skipped: ${unresolvedSources.map(s => s.url).join(', ')}`);
  }

  let allJobs: DiscoveredJob[] = [];
  let allUnstructured = '';

  const context: DiscoveryContext = {
    runId,
    sourceUrl: '',
    targetRoles: config.targetRoles || [],
    alternativeRoles: config.alternativeRoles || [],
    location: config.candidateCountry,
    remoteOnly: config.remoteRequirement === 'REMOTE_ONLY',
    strategyName: strategy.name,
    requiredSkills: config.requiredSkills || []
  };

  const discoveryStartTime = Date.now();
  let earlyTerminated = false;
  let terminationReason = '';

  // Telemetry metrics
  let sourcesAttempted = 0;
  let sourcesSuccessful = 0;
  let sourcesFailed = 0;
  let totalLatencyMs = 0;

  // 4. Execute Discovery Loop
  for (const source of sourcesToExecute) {
    if (abortSignal?.aborted) {
      earlyTerminated = true;
      terminationReason = 'Abort signal received';
      break;
    }

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

    // Resolve provider defensively: a malformed source URL or a misbehaving
    // provider.supports() implementation must skip this single source, not
    // abort discovery for every remaining source.
    let provider;
    try {
      provider = providerRegistry.findProviderForUrl(source.url);
    } catch (e: any) {
      console.warn(`[Discovery] Provider resolution threw for source '${source.url}', skipping this source: ${e.message}`);
      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        eventType: 'PROVIDER_RESOLUTION_FAILED',
        stage: 'DISCOVERY',
        payload: { url: source.url, error: e.message }
      });
      continue;
    }
    if (!provider) continue;

    sourcesAttempted++;
    console.log(`[Discovery] Crawling ${source.url} using ${provider.name} (Weight: ${source.weight})`);
    
    // Live feed granularity
    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'PROVIDER_STARTED',
      stage: 'DISCOVERY',
      payload: { provider: provider.name, url: source.url }
    });

    const sourceStartTime = Date.now();
    context.sourceUrl = source.url;

    const heartbeatInterval = setInterval(async () => {
      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        eventType: 'HEARTBEAT',
        stage: 'DISCOVERY',
        payload: { message: `Waiting for ${provider.name} response...`, provider: provider.name, url: source.url }
      });
    }, 5000);

    try {
      const result = await provider.discover(context);
      clearInterval(heartbeatInterval);

      const sourceLatency = Date.now() - sourceStartTime;
      totalLatencyMs += sourceLatency;
      sourcesSuccessful++;
      
      let jobsFromSource = 0;
      if (result.jobs?.length) {
        allJobs.push(...result.jobs.map(j => provider.normalize(j)));
        jobsFromSource = result.jobs.length;
      }
      if (result.unstructuredText) {
        allUnstructured += `\n\n--- Source: ${source.url} ---\n\n` + result.unstructuredText;
      }

      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        eventType: 'PROVIDER_COMPLETED',
        stage: 'DISCOVERY',
        payload: { provider: provider.name, jobsFound: jobsFromSource, latencyMs: sourceLatency }
      });
      
      await updateSourceHealth(source.url, true, sourceLatency, jobsFromSource);
      
    } catch (e: any) {
      clearInterval(heartbeatInterval);
      sourcesFailed++;
      console.error(`[Discovery] Error crawling ${source.url}:`, e);
      
      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId,
        timestamp: new Date().toISOString(),
        eventType: 'PROVIDER_FAILED',
        stage: 'DISCOVERY',
        payload: { provider: provider.name, error: e.message }
      });

      await updateSourceHealth(source.url, false, Date.now() - sourceStartTime, 0);
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
      sourcesAttempted,
      sourcesSuccessful,
      sourcesFailed,
      avgLatencyMs: sourcesAttempted > 0 ? Math.round(totalLatencyMs / sourcesAttempted) : 0,
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
