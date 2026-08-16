import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import type { DecisionContext, QueuedDecision } from '../decision/interfaces';
import type { AdaptiveLearningContext, LearningModifiers, TraitObservation } from './interfaces';

const MIN_OBSERVATION_THRESHOLD = 3;
const POSITIVE_DECISIONS = ['APPLY_NOW', 'APPLY_THIS_WEEK'];
const NEGATIVE_DECISIONS = ['SKIP', 'IGNORE'];
const MAX_PERCENTAGE_MODIFIER = 0.15; // ±15% cap

/**
 * Calculates learning traits for the given context (runId/configId).
 */
export async function calculateB7Modifiers(
  context: AdaptiveLearningContext,
  queue: QueuedDecision[]
): Promise<LearningModifiers> {
  if (queue.length === 0) return {};

  // Fetch decision history joined with jobs to get traits.
  // We use Drizzle's sql template to safely join and aggregate.
  // To ensure we scope by configId, we join to jobObservations -> runs -> huntConfigs
  // Note: For performance, we do a raw query or simple builder query.
  
  const historyQuery = await db.select({
    jobId: schema.decisionHistory.jobId,
    newDecision: schema.decisionHistory.newDecision,
    companyId: schema.jobs.companyId,
    remoteType: schema.jobs.remoteType
  }).from(schema.decisionHistory)
    .innerJoin(schema.jobs, eq(schema.decisionHistory.jobId, schema.jobs.id))
    .innerJoin(schema.jobObservations, eq(schema.jobs.id, schema.jobObservations.jobId))
    .innerJoin(schema.runs, eq(schema.jobObservations.runId, schema.runs.id))
    .where(eq(schema.runs.configId, context.configId));

  // Deduplicate by jobId so we only consider the latest decision per job in the history
  const latestDecisions = new Map<string, typeof historyQuery[0]>();
  for (const row of historyQuery) {
    // In SQLite, auto-increment/timestamp usually means later rows come last,
    // or we can just assume the most recent row overrides. 
    // Since we didn't order by timestamp, let's just let later rows override.
    latestDecisions.set(row.jobId, row);
  }

  // Aggregate observations by trait
  const companyObservations = new Map<string, { pos: number; neg: number; total: number }>();
  const remoteObservations = new Map<string, { pos: number; neg: number; total: number }>();

  for (const row of latestDecisions.values()) {
    if (!row.newDecision) continue;
    
    const isPositive = POSITIVE_DECISIONS.includes(row.newDecision);
    const isNegative = NEGATIVE_DECISIONS.includes(row.newDecision);
    
    if (!isPositive && !isNegative) continue;

    const updateTrait = (map: Map<string, { pos: number; neg: number; total: number }>, key: string | null) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, { pos: 0, neg: 0, total: 0 });
      const stats = map.get(key)!;
      stats.total += 1;
      if (isPositive) stats.pos += 1;
      if (isNegative) stats.neg += 1;
    };

    updateTrait(companyObservations, row.companyId);
    updateTrait(remoteObservations, row.remoteType);
  }

  // Convert to modifiers
  const calculateModifier = (pos: number, neg: number, total: number): number => {
    if (total < MIN_OBSERVATION_THRESHOLD) return 0;
    
    // Simple confidence weighting based on volume
    // Confidence approaches 1.0 as total observations grow past threshold
    const confidence = Math.min(1.0, total / (MIN_OBSERVATION_THRESHOLD * 2));
    
    // Net preference ratio: [-1.0 to 1.0]
    const netRatio = (pos - neg) / total;
    
    // Apply bounds and confidence
    return netRatio * confidence * MAX_PERCENTAGE_MODIFIER;
  };

  const companyMods = new Map<string, number>();
  for (const [id, stats] of companyObservations.entries()) {
    companyMods.set(id, calculateModifier(stats.pos, stats.neg, stats.total));
  }

  const remoteMods = new Map<string, number>();
  for (const [id, stats] of remoteObservations.entries()) {
    remoteMods.set(id, calculateModifier(stats.pos, stats.neg, stats.total));
  }

  // Calculate final percentage modifiers for the current queue
  const results: LearningModifiers = {};
  
  for (const q of queue) {
    let jobModifier = 0;
    
    if ((q.context.job as any).companyId && companyMods.has((q.context.job as any).companyId)) {
      jobModifier += companyMods.get((q.context.job as any).companyId)!;
    }
    
    if (q.context.job.remoteType && remoteMods.has(q.context.job.remoteType)) {
      jobModifier += remoteMods.get(q.context.job.remoteType)!;
    }

    // Clamp total job modifier to max percentage bounds
    results[q.jobId] = Math.max(-MAX_PERCENTAGE_MODIFIER, Math.min(MAX_PERCENTAGE_MODIFIER, jobModifier));
  }

  return results;
}
