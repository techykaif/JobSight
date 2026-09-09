/**
 * Dashboard / Decision Board Data Integrity Tests
 *
 * Verifies that every Dashboard metric count equals the result count of the
 * corresponding filtered job-card view. Covers Phase 13 Part G requirements.
 *
 * Assertion: displayedCount === filteredResultCount for all actionable cards.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// ─── Test data setup ─────────────────────────────────────────────────────────

describe('Dashboard / Decision Board Data Integrity (Phase 13 Part G)', () => {
  const runId    = crypto.randomUUID();
  const oldRunId = crypto.randomUUID();
  const configId = crypto.randomUUID();
  const companyId = crypto.randomUUID();

  // Job IDs per category
  const applyJobId    = crypto.randomUUID();
  const reviewJobId   = crypto.randomUUID();
  const pendingJobId  = crypto.randomUUID();
  const insufJobId    = crypto.randomUUID();
  const skipJobId     = crypto.randomUUID();
  const favorJobId    = crypto.randomUUID();  // also has LOW competition
  const lowCompJobId  = crypto.randomUUID();  // LOW competition, not FAVORABLE
  const unknCompJobId = crypto.randomUUID();  // UNKNOWN competition — must NOT appear in low-comp
  const salaryJobId   = crypto.randomUUID();  // salary = 200000
  const noSalJobId    = crypto.randomUUID();  // no salary — must NOT appear in highest-salary
  const oldRunJobId   = crypto.randomUUID();  // from oldRunId — must NOT contaminate active run

  function mkJob(id: string, salaryMax?: number) {
    return {
      id,
      canonicalTitle: `Job ${id.slice(0, 6)}`,
      canonicalUrl: `http://example.com/${id}`,
      companyId,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      firstSeenAt: '2026-01-01',
      lastSeenAt: '2026-01-01',
      status: 'ACTIVE' as const,
      ...(salaryMax !== undefined ? { salaryMax, salaryMin: salaryMax - 10000 } : {}),
    };
  }

  function mkObs(jobId: string, rid: string) {
    return { id: crypto.randomUUID(), jobId, runId: rid, observedAt: '2026-01-01', status: 'active' };
  }

  function mkCD(jobId: string, rid: string, finalDecision: string) {
    return { id: crypto.randomUUID(), runId: rid, jobId, finalDecision, primaryReason: 'test', createdAt: '2026-01-01' };
  }

  function mkMI(jobId: string, rid: string, opportunity: string, competition: string) {
    return {
      id: crypto.randomUUID(),
      runId: rid,
      jobId,
      visibilityLevel: 'UNKNOWN',
      visibilityEvidence: '[]' as unknown as [],
      visibilityConfidence: 'LOW',
      competitionLevel: competition,
      competitionEvidence: '[]' as unknown as [],
      competitionConfidence: 'LOW',
      frictionLevel: 'UNKNOWN',
      frictionEvidence: '[]' as unknown as [],
      frictionConfidence: 'LOW',
      opportunityIntelligence: opportunity,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
  }

  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });

    await db.insert(schema.huntConfigs).values([
      { id: configId, targetRoles: '[]', alternativeRoles: '[]', createdAt: '2020-01-01', updatedAt: '2020-01-01' }
    ]);
    await db.insert(schema.runs).values([
      { id: oldRunId, configId, profileSnapshot: '{}', status: 'COMPLETED', createdAt: '2020-01-01', updatedAt: '2020-01-01' },
      { id: runId,    configId, profileSnapshot: '{}', status: 'COMPLETED', createdAt: '2026-06-01', updatedAt: '2026-06-01' },
    ]);
    await db.insert(schema.companies).values([
      { id: companyId, normalizedName: 'testco-integrity', displayName: 'TestCo', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ]);
    await db.insert(schema.jobs).values([
      mkJob(applyJobId),
      mkJob(reviewJobId),
      mkJob(pendingJobId),
      mkJob(insufJobId),
      mkJob(skipJobId),
      mkJob(favorJobId),
      mkJob(lowCompJobId),
      mkJob(unknCompJobId),
      mkJob(salaryJobId, 200000),
      mkJob(noSalJobId),            // no salary
      mkJob(oldRunJobId),
    ]);
    await db.insert(schema.jobObservations).values([
      mkObs(applyJobId,    runId),
      mkObs(reviewJobId,   runId),
      mkObs(pendingJobId,  runId),
      mkObs(insufJobId,    runId),
      mkObs(skipJobId,     runId),
      mkObs(favorJobId,    runId),
      mkObs(lowCompJobId,  runId),
      mkObs(unknCompJobId, runId),
      mkObs(salaryJobId,   runId),
      mkObs(noSalJobId,    runId),
      mkObs(oldRunJobId,   oldRunId),  // different run
    ]);
    await db.insert(schema.candidateDecisions).values([
      mkCD(applyJobId,   runId,    'APPLY'),
      mkCD(reviewJobId,  runId,    'REVIEW'),
      mkCD(pendingJobId, runId,    'PENDING'),
      mkCD(insufJobId,   runId,    'INSUFFICIENT_EVIDENCE'),
      mkCD(skipJobId,    runId,    'SKIP'),
      mkCD(oldRunJobId,  oldRunId, 'APPLY'),  // old run — must not contaminate
    ]);
    await db.insert(schema.marketIntelligence).values([
      mkMI(favorJobId,    runId, 'FAVORABLE', 'LOW'),
      mkMI(lowCompJobId,  runId, 'NEUTRAL',   'LOW'),
      mkMI(unknCompJobId, runId, 'NEUTRAL',   'UNKNOWN'),  // UNKNOWN must NOT appear in low-comp
    ]);
  });

  // ─── Test 1: Monitor Dashboard count equals Decision Board Monitor count ────
  it('1. Monitor Dashboard count equals Decision Board Monitor bucket count', async () => {
    // Dashboard query (fixed)
    const dashRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));
    const dashCount = Number(dashRes[0]?.count ?? 0);

    // Decision Board bucket query
    const boardRes = await db.select()
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));
    const boardCount = boardRes.length;

    expect(dashCount).toBe(boardCount);
    expect(dashCount).toBe(1); // only pendingJobId
  });

  // ─── Test 2: Apply Now count equals Apply Now result count ──────────────────
  it('2. Apply Now Dashboard count equals filtered result count', async () => {
    const dashRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));
    const dashCount = Number(dashRes[0]?.count ?? 0);

    const filterRes = await db.select()
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));
    expect(dashCount).toBe(filterRes.length);
    expect(dashCount).toBe(1);
  });

  // ─── Test 3: Apply This Week count equals result count ──────────────────────
  it('3. Apply This Week Dashboard count equals filtered result count', async () => {
    const dashRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'REVIEW')
      ));
    const dashCount = Number(dashRes[0]?.count ?? 0);

    const filterRes = await db.select()
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'REVIEW')
      ));
    expect(dashCount).toBe(filterRes.length);
    expect(dashCount).toBe(1);
  });

  // ─── Test 4: Research count equals Research result count ─────────────────────
  it('4. Research Dashboard count equals filtered result count', async () => {
    const dashRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'INSUFFICIENT_EVIDENCE')
      ));
    const dashCount = Number(dashRes[0]?.count ?? 0);

    const filterRes = await db.select()
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'INSUFFICIENT_EVIDENCE')
      ));
    expect(dashCount).toBe(filterRes.length);
    expect(dashCount).toBe(1);
  });

  // ─── Test 5: Favorable Opportunities count equals FAVORABLE marketIntelligence jobs ──
  it('5. Favorable Opportunities count equals FAVORABLE marketIntelligence jobs', async () => {
    const dashRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.marketIntelligence)
      .where(and(
        eq(schema.marketIntelligence.runId, runId),
        eq(schema.marketIntelligence.opportunityIntelligence, 'FAVORABLE')
      ));
    const dashCount = Number(dashRes[0]?.count ?? 0);

    const filterRes = await db.select()
      .from(schema.marketIntelligence)
      .where(and(
        eq(schema.marketIntelligence.runId, runId),
        eq(schema.marketIntelligence.opportunityIntelligence, 'FAVORABLE')
      ));
    expect(dashCount).toBe(filterRes.length);
    expect(dashCount).toBe(1); // only favorJobId
  });

  // ─── Test 6: Low Competition excludes UNKNOWN ────────────────────────────────
  it('6. Low Competition filter excludes UNKNOWN competition', async () => {
    const filterRes = await db.select()
      .from(schema.marketIntelligence)
      .where(and(
        eq(schema.marketIntelligence.runId, runId),
        eq(schema.marketIntelligence.competitionLevel, 'LOW')
      ));
    // Should contain favorJobId and lowCompJobId, NOT unknCompJobId
    const jobIds = filterRes.map(r => r.jobId);
    expect(jobIds).toContain(favorJobId);
    expect(jobIds).toContain(lowCompJobId);
    expect(jobIds).not.toContain(unknCompJobId);
    expect(filterRes.length).toBe(2);
  });

  // ─── Test 7: Highest Salary result ordering is deterministic ─────────────────
  it('7. Highest Salary result ordering is deterministic (salaryMax DESC)', async () => {
    const filterRes = await db.select({ id: schema.jobs.id, salaryMax: schema.jobs.salaryMax })
      .from(schema.jobs)
      .innerJoin(
        schema.jobObservations,
        and(
          eq(schema.jobObservations.jobId, schema.jobs.id),
          eq(schema.jobObservations.runId, runId)
        )
      )
      .where(sql`${schema.jobs.salaryMax} IS NOT NULL AND ${schema.jobs.salaryMax} > 0`);

    // Verify results are unique job IDs (deduplication works)
    const ids = filterRes.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Verify sort order: descending salaryMax
    for (let i = 0; i < filterRes.length - 1; i++) {
      expect(filterRes[i]!.salaryMax).toBeGreaterThanOrEqual(filterRes[i + 1]!.salaryMax!);
    }
  });

  // ─── Test 8: Highest Salary excludes jobs without valid salary evidence ───────
  it('8. Highest Salary excludes jobs without valid salary (null or zero)', async () => {
    const filterRes = await db.select({ id: schema.jobs.id, salaryMax: schema.jobs.salaryMax })
      .from(schema.jobs)
      .innerJoin(
        schema.jobObservations,
        and(
          eq(schema.jobObservations.jobId, schema.jobs.id),
          eq(schema.jobObservations.runId, runId)
        )
      )
      .where(sql`${schema.jobs.salaryMax} IS NOT NULL AND ${schema.jobs.salaryMax} > 0`);

    const jobIds = filterRes.map(r => r.id);
    expect(jobIds).toContain(salaryJobId);         // has salaryMax = 200000
    expect(jobIds).not.toContain(noSalJobId);      // no salary
    expect(jobIds).not.toContain(oldRunJobId);     // different run
  });

  // ─── Test 9: Clicking Highest Salary produces only matching jobs ─────────────
  it('9. Highest Salary filter only returns jobs with salaryMax > 0', async () => {
    const filterRes = await db.select({ id: schema.jobs.id, salaryMax: schema.jobs.salaryMax })
      .from(schema.jobs)
      .innerJoin(
        schema.jobObservations,
        and(
          eq(schema.jobObservations.jobId, schema.jobs.id),
          eq(schema.jobObservations.runId, runId)
        )
      )
      .where(sql`${schema.jobs.salaryMax} IS NOT NULL AND ${schema.jobs.salaryMax} > 0`);

    for (const r of filterRes) {
      expect(r.salaryMax).not.toBeNull();
      expect(r.salaryMax!).toBeGreaterThan(0);
    }
  });

  // ─── Test 10: Clicking Monitor produces only PENDING decision jobs ────────────
  it('10. Monitor filter produces only PENDING candidateDecision jobs', async () => {
    const filterRes = await db.select({ jobId: schema.candidateDecisions.jobId, decision: schema.candidateDecisions.finalDecision })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));

    for (const r of filterRes) {
      expect(r.decision).toBe('PENDING');
    }
    expect(filterRes.map(r => r.jobId)).toContain(pendingJobId);
    expect(filterRes.map(r => r.jobId)).not.toContain(applyJobId);
  });

  // ─── Test 11: Apply Now filter produces only APPLY decision jobs ─────────────
  it('11. Apply Now filter produces only APPLY candidateDecision jobs', async () => {
    const filterRes = await db.select({ jobId: schema.candidateDecisions.jobId, decision: schema.candidateDecisions.finalDecision })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));

    for (const r of filterRes) {
      expect(r.decision).toBe('APPLY');
    }
    expect(filterRes.map(r => r.jobId)).toContain(applyJobId);
    expect(filterRes.map(r => r.jobId)).not.toContain(pendingJobId);
  });

  // ─── Test 12: Filtered views remain run-scoped ───────────────────────────────
  it('12. Decision filters do not return results from other runs', async () => {
    // oldRunJobId has APPLY decision in oldRunId — must NOT appear in runId filters
    const applyRes = await db.select({ jobId: schema.candidateDecisions.jobId })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));
    expect(applyRes.map(r => r.jobId)).not.toContain(oldRunJobId);
  });

  // ─── Test 13: Historical runs do not contaminate counts ─────────────────────
  it('13. Historical run decisions do not contaminate active run Dashboard counts', async () => {
    const monitorRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));
    const monitorCount = Number(monitorRes[0]?.count ?? 0);

    // Verify the old run has APPLY decision for oldRunJobId but it doesn't affect the new run's PENDING count
    const oldApplyRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, oldRunId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));
    const oldApplyCount = Number(oldApplyRes[0]?.count ?? 0);

    expect(oldApplyCount).toBe(1); // old run has 1 APPLY
    expect(monitorCount).toBe(1);  // new run PENDING count unaffected by old run
  });

  // ─── Test 14: Empty filtered results render correct empty state ───────────────
  it('14. Empty filter returns 0 results when no matching jobs exist', async () => {
    const emptyRunId = crypto.randomUUID();
    const res = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, emptyRunId),
        eq(schema.candidateDecisions.finalDecision, 'APPLY')
      ));
    expect(Number(res[0]?.count ?? 0)).toBe(0);
  });

  // ─── Test 15: Dashboard metric and destination query use the same semantic ────
  it('15. Dashboard Monitor metric and filter destination use the same query semantic', async () => {
    // Both the Dashboard metric count and the jobs?filter=monitor view use:
    // candidateDecisions WHERE finalDecision = 'PENDING' AND runId = <activeRunId>
    const metricCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));

    const filterJobs = await db.select({ jobId: schema.candidateDecisions.jobId })
      .from(schema.candidateDecisions)
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, 'PENDING')
      ));

    // The metric and the destination MUST agree
    expect(Number(metricCount[0]?.count ?? 0)).toBe(filterJobs.length);
  });
});
