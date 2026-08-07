import { db } from '../db/client';
import * as schema from '../db/schema';
import type { ApplicationIntelligenceOutput } from './interfaces';
import crypto from 'crypto';

export async function persistApplicationIntelligence(output: ApplicationIntelligenceOutput) {
  const { jobId, runId, signals, result, summary, recommendation } = output;
  const now = new Date().toISOString();

  // 1. Persist signals
  for (const sig of signals) {
    await db.insert(schema.applicationSignals).values({
      id: crypto.randomUUID(),
      runId,
      jobId,
      signalType: sig.type,
      value: sig.value != null ? JSON.stringify(sig.value) : null,
      weight: sig.weight,
      metadata: sig.metadata,
      createdAt: now
    });
  }

  // 2. Persist results
  await db.insert(schema.applicationResults).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    score: result.score,
    readinessLevel: result.readinessLevel,
    confidence: result.confidence,
    createdAt: now
  });

  // 3. Persist summary
  await db.insert(schema.applicationSummary).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    strengths: summary.strengths as any,
    weaknesses: summary.weaknesses as any,
    missingSkills: summary.missingSkills as any,
    riskFactors: summary.riskFactors as any,
    createdAt: now
  });

  // 4. Persist recommendations
  await db.insert(schema.applicationRecommendations).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    recommendation,
    createdAt: now
  });
}
