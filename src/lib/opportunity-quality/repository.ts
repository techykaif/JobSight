import { db } from '../db/client.js';
import { marketIntelligence as schema } from '../db/schema.js';
import type { CanonicalOpportunityQuality } from './interfaces.js';
import crypto from 'crypto';

export async function saveCanonicalOpportunityQuality(runId: string, jobId: string, result: CanonicalOpportunityQuality) {
  return db.insert(schema).values({
    id: crypto.randomUUID(),
    runId,
    jobId,

    visibilityLevel: result.signals.visibility,
    visibilityEvidence: {}, // Deprecated legacy field, keep empty obj
    visibilityConfidence: 'UNKNOWN', // Deprecated

    competitionLevel: result.signals.competition,
    competitionEvidence: {}, // Deprecated
    competitionConfidence: 'UNKNOWN', // Deprecated

    frictionLevel: result.signals.friction,
    frictionEvidence: {}, // Deprecated
    frictionConfidence: 'UNKNOWN', // Deprecated

    applicantVolume: result.signals.applicantVolume === 'UNKNOWN' ? null : result.signals.applicantVolume,
    applicantVolumeIsLowerBound: false,
    applicantVolumeObservedAt: new Date().toISOString(),

    opportunityIntelligence: result.opportunityLevel,

    freshnessLevel: result.signals.freshness,
    compensationLevel: result.signals.compensation,
    authenticityLevel: result.signals.authenticity,
    canonicalEvidence: result.evidence,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}
