import { db } from '../db/client';
import * as schema from '../db/schema';
import type { IntelligenceFoundationOutput } from './interfaces';
import crypto from 'crypto';

export async function persistIntelligenceFoundation(output: IntelligenceFoundationOutput) {
  const { jobId, runId, signals, evidence, confidence, summary } = output;
  const now = new Date().toISOString();

  // 1. Persist signals
  for (const sig of signals) {
    await db.insert(schema.observableSignals).values({
      id: crypto.randomUUID(),
      runId,
      jobId,
      signalType: sig.type,
      observedValue: String(sig.value),
      metadata: sig.metadata,
      createdAt: now
    });
  }

  // 2. Group evidence by category for opportunity_evidence
  const evidenceByCategory = evidence.reduce((acc, ev) => {
    if (!acc[ev.category]) acc[ev.category] = [];
    acc[ev.category]!.push(ev);
    return acc;
  }, {} as Record<string, typeof evidence>);

  for (const [category, itemsRaw] of Object.entries(evidenceByCategory)) {
    const items = itemsRaw!;
    const oppEvId = crypto.randomUUID();
    const catConfidence = Math.round(items.reduce((sum, i) => sum + i.confidence, 0) / items.length);
    
    await db.insert(schema.opportunityEvidence).values({
      id: oppEvId,
      runId,
      jobId,
      category,
      confidence: catConfidence,
      createdAt: now
    });

    for (const item of items) {
      await db.insert(schema.evidenceItems).values({
        id: crypto.randomUUID(),
        opportunityEvidenceId: oppEvId,
        category: item.category,
        title: item.title,
        description: item.description,
        observedValue: String(item.observedValue),
        normalizedValue: String(item.normalizedValue),
        weight: item.weight,
        confidence: item.confidence,
        source: item.source,
        timestamp: item.timestamp,
        metadata: item.metadata
      });
    }
  }

  // 3. Persist confidence results
  await db.insert(schema.confidenceResults).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    confidenceScore: confidence.score,
    factors: confidence.factors,
    createdAt: now
  });

  // 4. Persist summary
  await db.insert(schema.evidenceSummary).values({
    id: crypto.randomUUID(),
    runId,
    jobId,
    opportunityScore: summary.opportunityScore,
    confidence: summary.confidence,
    evidenceChecklist: summary.evidenceChecklist,
    createdAt: now
  });
}
