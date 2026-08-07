import { db } from '../db/client';
import * as schema from '../db/schema';
import type { CompanyOpportunityIntelligenceOutput } from './interfaces';
import crypto from 'crypto';

export async function persistCompanyOpportunityIntelligence(output: CompanyOpportunityIntelligenceOutput) {
  const { companyId, runId, signals, result, outlook, summary } = output;
  const now = new Date().toISOString();

  // 1. Persist signals
  for (const sig of signals) {
    await db.insert(schema.companySignals).values({
      id: crypto.randomUUID(),
      runId,
      companyId,
      signalType: sig.type,
      value: sig.value != null ? String(sig.value) : null,
      weight: sig.weight,
      metadata: sig.metadata,
      createdAt: now
    });
  }

  // 2. Persist results
  await db.insert(schema.companyOpportunity).values({
    id: crypto.randomUUID(),
    runId,
    companyId,
    score: result.score,
    level: result.level,
    confidence: result.confidence,
    createdAt: now
  });

  // 3. Persist outlook
  await db.insert(schema.companyOutlook).values({
    id: crypto.randomUUID(),
    runId,
    companyId,
    trend: outlook.trend,
    stability: outlook.stability,
    momentum: outlook.momentum,
    createdAt: now
  });

  // 4. Persist summary
  await db.insert(schema.companySummary).values({
    id: crypto.randomUUID(),
    runId,
    companyId,
    outlook: summary.outlook,
    hiringTrend: summary.hiringTrend,
    remoteHiring: summary.remoteHiring,
    engineeringHiring: summary.engineeringHiring,
    competition: summary.competition,
    authenticity: summary.authenticity,
    evidenceCount: summary.evidenceCount,
    confidence: summary.confidence,
    createdAt: now
  });
}
