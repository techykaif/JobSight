import { db } from '../db/client';
import * as schema from '../db/schema';
import type { DiscoveryIntelligenceOutput } from './interfaces';
import crypto from 'crypto';

export async function persistDiscoveryIntelligence(output: DiscoveryIntelligenceOutput) {
  const { jobId, runId, signals, result, summary } = output;
  const now = new Date().toISOString();

  // 1. Persist signals
  for (const sig of signals) {
    await db.insert(schema.oppDiscoverySignals).values({
      id: crypto.randomUUID(),
      runId,
      jobId,
      signalType: sig.type,
      value: sig.value != null ? String(sig.value) : null,
      weight: sig.weight,
      metadata: sig.metadata,
      createdAt: now
    });
  }

  // 2. Persist results
  await db.insert(schema.oppDiscoveryResults).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    score: result.score,
    level: result.level,
    confidence: result.confidence,
    createdAt: now
  });

  // 3. Persist summary
  await db.insert(schema.oppDiscoverySummary).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    quality: summary.quality,
    source: summary.source,
    visibility: summary.visibility,
    uniqueness: summary.uniqueness,
    competition: summary.competition,
    authenticity: summary.authenticity,
    evidenceCount: summary.evidenceCount,
    confidence: summary.confidence,
    createdAt: now
  });
}
