import crypto from 'crypto';
import * as repos from '../db/repositories/index.js';
import { analyzerRegistry } from './registry.js';
import { registerCoreAnalyzers } from './analyzers/index.js';
import type { AnalyzerContext, DiscoveryIntelligenceOutput } from './interfaces.js';

// Ensure analyzers are registered
registerCoreAnalyzers();

export async function runDiscoveryIntelligence(context: AnalyzerContext): Promise<DiscoveryIntelligenceOutput> {
  const analyzers = analyzerRegistry.getAll();
  
  let totalConfidence = 0;
  let allSignals: string[] = [];
  let allUnknowns: string[] = [];
  const results: any = {};

  for (const analyzer of analyzers) {
    if (!analyzer.supports(context)) continue;

    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId: context.runId,
      timestamp: new Date().toISOString(),
      eventType: 'ANALYZER_STARTED',
      stage: 'INTELLIGENCE',
      entityType: 'JOB',
      entityId: context.job.sourceUrl, // Need unique ID, for now using sourceUrl
      payload: { analyzer: analyzer.name }
    });

    const start = Date.now();
    try {
      const result = await analyzer.analyze(context);
      
      Object.assign(results, result.output);
      totalConfidence += result.confidence;
      allSignals.push(...result.signals);
      allUnknowns.push(...result.unknowns);

      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId: context.runId,
        timestamp: new Date().toISOString(),
        eventType: 'ANALYZER_COMPLETED',
        stage: 'INTELLIGENCE',
        entityType: 'JOB',
        entityId: context.job.sourceUrl,
        payload: { 
          analyzer: analyzer.name,
          duration: Date.now() - start,
          confidence: result.confidence,
          unknowns: result.unknowns.length
        }
      });
    } catch (e: any) {
      console.error(`[Intelligence] Analyzer ${analyzer.name} failed:`, e);
      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId: context.runId,
        timestamp: new Date().toISOString(),
        eventType: 'ANALYZER_FAILED',
        stage: 'INTELLIGENCE',
        entityType: 'JOB',
        entityId: context.job.sourceUrl,
        payload: { analyzer: analyzer.name, error: e.message }
      });
    }
  }

  const avgConfidence = analyzers.length > 0 ? Math.round(totalConfidence / analyzers.length) : 0;

  const intelligence: DiscoveryIntelligenceOutput = {
    hiddenGem: results.hiddenGem || 'UNKNOWN',
    visibility: results.visibility || 'UNKNOWN',
    authenticity: results.authenticity || 'UNKNOWN',
    competition: results.competition || 'UNKNOWN',
    freshness: results.freshness || 'UNKNOWN',
    sourceTrust: results.sourceTrust || 'UNKNOWN',
    confidence: avgConfidence,
    signals: [...new Set(allSignals)], // Deduplicate signals
    unknowns: [...new Set(allUnknowns)]
  };

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId: context.runId,
    timestamp: new Date().toISOString(),
    eventType: 'DISCOVERY_INTELLIGENCE_COMPLETED',
    stage: 'INTELLIGENCE',
    entityType: 'JOB',
    entityId: context.job.sourceUrl,
    payload: { confidence: avgConfidence, unknowns: intelligence.unknowns.length }
  });

  return intelligence;
}
