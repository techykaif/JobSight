import { db } from '../client.js';
import { marketIntelligence as schema } from '../schema.js';
import { eq } from 'drizzle-orm';
import type { MarketIntelligenceResult } from '../../intelligence/market/interfaces.js';

export async function saveMarketIntelligence(runId: string, jobId: string, result: MarketIntelligenceResult) {
  return db.insert(schema).values({
    id: crypto.randomUUID(),
    runId,
    jobId,

    visibilityLevel: result.visibility.level,
    visibilityEvidence: result.visibility.evidence,
    visibilityConfidence: result.visibility.confidence,

    competitionLevel: result.competition.level,
    competitionEvidence: result.competition.evidence,
    competitionConfidence: result.competition.confidence,

    frictionLevel: result.friction.level,
    frictionEvidence: result.friction.signals,
    frictionConfidence: result.friction.confidence,

    applicantVolume: result.competition.applicantVolume?.value ?? null,
    applicantVolumeIsLowerBound: result.competition.applicantVolume?.isLowerBound ?? null,
    applicantVolumeObservedAt: result.competition.applicantVolume?.observedAt ?? null,

    opportunityIntelligence: result.opportunityIntelligence,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function getMarketIntelligence(jobId: string) {
  const result = await db.select().from(schema).where(eq(schema.jobId, jobId)).limit(1);
  return result[0];
}
