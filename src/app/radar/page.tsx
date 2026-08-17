import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq, sql, or, like, inArray } from 'drizzle-orm';
import styles from './radar.module.css';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discovery Radar — JobSight',
  description: 'Real-time intelligence — hidden gems, highest compensation, fast-hiring companies, and global remote opportunities.',
};

// Inline empty state for radar sections
const EmptyState = ({ message, icon }: { message: string; icon: string }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon}</div>
    <p className={styles.emptyText}>{message}</p>
  </div>
);

export default async function DiscoveryRadarPage() {
  // 1. Hidden Gems
  const hiddenGems = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .innerJoin(schema.discoveryIntelligence, eq(schema.jobs.id, schema.discoveryIntelligence.jobId))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(eq(schema.discoveryIntelligence.hiddenGem, true))
    .limit(6);

  // 2. Highest Compensation
  const highestComp = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.jobs.salaryMax))
    .limit(6);

  // 3. Fast Growing Companies
  const fastGrowing = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .innerJoin(schema.companyAnalysis, eq(schema.jobs.companyId, schema.companyAnalysis.companyId))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(eq(schema.companyAnalysis.growthSignal, 'HIGH'))
    .limit(6);

  // 4. Global Remote
  const globalRemote = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(or(like(schema.jobs.remoteType, '%REMOTE%'), like(schema.jobs.candidateRemoteEligibility, '%ELIGIBLE%')))
    .limit(6);

  // 5. India
  const indiaJobs = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(like(schema.jobs.location, '%India%'))
    .limit(6);

  // 6. AI Companies
  // Use word-boundary patterns for "AI" to prevent false positives on
  // 'Container', 'Retail', 'Chair', 'Email', 'Maintenance', etc.
  // SQLite LIKE is case-insensitive for ASCII, so 'AI %' also matches 'ai '.
  const aiJobs = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(or(
      // Title: word-boundary patterns for standalone "AI"
      like(schema.jobs.canonicalTitle, 'AI %'),          // "AI Engineer", "AI Lead"
      like(schema.jobs.canonicalTitle, '% AI %'),         // "Senior AI Engineer"
      like(schema.jobs.canonicalTitle, '% AI'),           // "Head of AI"
      sql`lower(${schema.jobs.canonicalTitle}) = 'ai'`,  // Exactly "AI"
      // Title: word-boundary patterns for standalone "ML"
      like(schema.jobs.canonicalTitle, 'ML %'),
      like(schema.jobs.canonicalTitle, '% ML %'),
      like(schema.jobs.canonicalTitle, '% ML'),
      sql`lower(${schema.jobs.canonicalTitle}) = 'ml'`,
      // Title: explicit multi-word patterns safe from false positives
      like(schema.jobs.canonicalTitle, '%Machine Learning%'),
      like(schema.jobs.canonicalTitle, '%Artificial Intelligence%'),
      like(schema.jobs.canonicalTitle, '%Deep Learning%'),
      like(schema.jobs.canonicalTitle, '%Neural%'),
      like(schema.jobs.canonicalTitle, '%LLM%'),
      like(schema.jobs.canonicalTitle, '%NLP%'),
      like(schema.jobs.canonicalTitle, '%GenAI%'),
      like(schema.jobs.canonicalTitle, '%Gen AI%'),
      like(schema.jobs.canonicalTitle, '%MLOps%'),
      like(schema.jobs.canonicalTitle, '%Computer Vision%'),
      // Description: explicit phrases — avoids matching 'paid', 'trail', 'email', etc.
      like(schema.jobs.description, '%artificial intelligence%'),
      like(schema.jobs.description, '%machine learning%'),
      like(schema.jobs.description, '%deep learning%'),
    ))
    .limit(6);

  // 7. Fast Hiring
  const fastHiring = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
    })
    .from(schema.jobs)
    .innerJoin(schema.companyAnalysis, eq(schema.jobs.companyId, schema.companyAnalysis.companyId))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(eq(schema.companyAnalysis.hiringMomentum, 'HIGH'))
    .limit(6);

  // 8. Highest Opportunity
  const highestOpportunity = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      companyId: schema.jobs.companyId,
      candidateRemoteEligibility: schema.jobs.candidateRemoteEligibility,
      opportunityScore: schema.opportunityIntelligence.opportunityScore,
    })
    .from(schema.jobs)
    .innerJoin(schema.opportunityIntelligence, eq(schema.jobs.id, schema.opportunityIntelligence.jobId))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.opportunityIntelligence.opportunityScore))
    .limit(6);

  const sections = [
    { title: 'Hidden Gems', emoji: '💎', data: hiddenGems, emptyMsg: 'The AI is still scanning the depths for hidden opportunities.', emptyIcon: '🔭' },
    { title: 'Highest Compensation', emoji: '💰', data: highestComp, emptyMsg: 'Awaiting salary data to surface the best-paying roles.', emptyIcon: '💸' },
    { title: 'Fast Growing Companies', emoji: '📈', data: fastGrowing, emptyMsg: 'No hyper-growth signals detected yet.', emptyIcon: '🚀' },
    { title: 'Global Remote', emoji: '🌍', data: globalRemote, emptyMsg: 'No global remote opportunities found right now.', emptyIcon: '🌐' },
    { title: 'India', emoji: '🇮🇳', data: indiaJobs, emptyMsg: 'No India opportunities found at the moment.', emptyIcon: '📍' },
    { title: 'AI & Machine Learning', emoji: '🧠', data: aiJobs, emptyMsg: 'No AI/ML roles found right now.', emptyIcon: '🤖' },
    { title: 'Fast Hiring', emoji: '⚡', data: fastHiring, emptyMsg: 'No fast-hiring signals detected yet.', emptyIcon: '🏎️' },
    { title: 'Highest Opportunity Score', emoji: '⭐', data: highestOpportunity, emptyMsg: 'Opportunity scores are being calculated.', emptyIcon: '🎯' },
  ];

  const totalOpportunities = sections.reduce((sum, s) => sum + s.data.length, 0);

  // ── D1.5 Batched Intelligence Loading ───────────────────────────────────────────
  const allJobs = sections.flatMap(s => s.data);
  const jobIds = [...new Set(allJobs.map(j => j.id))];
  const companyIds = [...new Set(allJobs.map(j => j.companyId).filter((id): id is string => !!id))];

  function chunk<T>(arr: T[], size = 100): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function latestByKey<T extends { createdAt: string }>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
    const out = new Map<string, T>();
    for (const row of rows) {
      const key = keyOf(row);
      const existing = out.get(key);
      if (!existing || row.createdAt > existing.createdAt) out.set(key, row);
    }
    return out;
  }

  const competitionRows: (typeof schema.competitionResults.$inferSelect)[] = [];
  const applicationRows: (typeof schema.applicationResults.$inferSelect)[] = [];
  const decisionResultRows: (typeof schema.decisionResults.$inferSelect)[] = [];
  const discoveryRows: (typeof schema.discoveryIntelligence.$inferSelect)[] = [];

  for (const idChunk of chunk(jobIds)) {
    if (idChunk.length === 0) continue;
    competitionRows.push(...await db.select().from(schema.competitionResults).where(inArray(schema.competitionResults.jobId, idChunk)));
    applicationRows.push(...await db.select().from(schema.applicationResults).where(inArray(schema.applicationResults.jobId, idChunk)));
    decisionResultRows.push(...await db.select().from(schema.decisionResults).where(inArray(schema.decisionResults.jobId, idChunk)));
    discoveryRows.push(...await db.select().from(schema.discoveryIntelligence).where(inArray(schema.discoveryIntelligence.jobId, idChunk)));
  }

  const companyOpportunityRows: (typeof schema.companyOpportunity.$inferSelect)[] = [];
  for (const idChunk of chunk(companyIds)) {
    if (idChunk.length === 0) continue;
    companyOpportunityRows.push(...await db.select().from(schema.companyOpportunity).where(inArray(schema.companyOpportunity.companyId, idChunk)));
  }

  const competitionByJobId = latestByKey(competitionRows, r => r.jobId);
  const applicationByJobId = latestByKey(applicationRows, r => r.jobId);
  const decisionConfidenceByJobId = latestByKey(decisionResultRows, r => r.jobId);
  const companyOpportunityByCompanyId = latestByKey(companyOpportunityRows, r => r.companyId);
  const discoveryByJobId = latestByKey(discoveryRows, r => r.jobId);

  // Preserve B7 ranking order if prioritizing nudged elements within the radar section limits
  for (const section of sections) {
    section.data.sort((a, b) => {
      const pA = Number(decisionConfidenceByJobId.get(a.id)?.priority || 0);
      const pB = Number(decisionConfidenceByJobId.get(b.id)?.priority || 0);
      if (pA === 0 && pB === 0) return 0;
      return pB - pA;
    });
  }
  // ────────────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Discovery Radar' }]} />
        <div style={{ marginTop: 16 }}>
          <h1 className={styles.title}>Discovery Radar</h1>
          <p className={styles.subtitle}>
            {totalOpportunities} opportunities surfaced across {sections.filter(s => s.data.length > 0).length} intelligence categories
          </p>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, idx) => (
        <section key={idx} className={styles.section} aria-label={section.title}>
          {/* Section header */}
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>
              <span aria-hidden="true">{section.emoji}</span>
              {section.title}
            </h2>
            <div className={styles.sectionDivider} />
            <span className={styles.sectionCount}>{section.data.length}</span>
          </div>

          {section.data.length > 0 ? (
            <div className={styles.grid}>
              {section.data.map(job => {
                const comp = competitionByJobId.get(job.id)?.level || discoveryByJobId.get(job.id)?.competition;
                const readiness = applicationByJobId.get(job.id)?.readinessLevel;
                const companyOpp = companyOpportunityByCompanyId.get(job.companyId!)?.level;
                const confidence = decisionConfidenceByJobId.get(job.id)?.confidence;

                return (
                  <JobCard
                    key={job.id}
                    id={job.id}
                    title={job.canonicalTitle || job.normalizedTitle || 'Unknown Role'}
                    company={job.companyName || 'Unknown Company'}
                    salaryMin={job.salaryMin ?? undefined}
                    salaryMax={job.salaryMax ?? undefined}
                    remote={job.remoteType === 'REMOTE' || job.remoteType === 'FULLY_REMOTE'}
                    score={(job as any).opportunityScore ?? undefined}
                    competition={comp ?? undefined}
                    readiness={readiness ?? undefined}
                    companyOpportunity={companyOpp ?? undefined}
                    confidence={confidence ?? undefined}
                    eligibility={job.candidateRemoteEligibility ?? undefined}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState message={section.emptyMsg} icon={section.emptyIcon} />
          )}
        </section>
      ))}
    </div>
  );
}
