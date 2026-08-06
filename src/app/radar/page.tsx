import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq, sql, or, like, and } from 'drizzle-orm';
import styles from './radar.module.css';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { SectionHeader } from '@/components/ui/SectionHeader';

// Helper component for Empty State
const EmptyState = ({ message, icon }: { message: string, icon: string }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon}</div>
    <p>{message}</p>
  </div>
);

export default async function DiscoveryRadarPage() {
  // Fetch data for each section
  
  // 1. Hidden Gems
  const hiddenGems = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
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
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
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
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      growthSignal: schema.companyAnalysis.growthSignal,
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
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
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
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(like(schema.jobs.location, '%India%'))
    .limit(6);

  // 6. AI Companies
  const aiJobs = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(or(like(schema.jobs.description, '%AI%'), like(schema.jobs.description, '%Machine Learning%'), like(schema.jobs.canonicalTitle, '%AI%')))
    .limit(6);

  // 7. Fast Hiring
  const fastHiring = await db
    .select({
      id: schema.jobs.id,
      canonicalTitle: schema.jobs.canonicalTitle,
      normalizedTitle: schema.jobs.normalizedTitle,
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
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
      location: schema.jobs.location,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      companyName: schema.companies.displayName,
      opportunityScore: schema.opportunityIntelligence.opportunityScore,
    })
    .from(schema.jobs)
    .innerJoin(schema.opportunityIntelligence, eq(schema.jobs.id, schema.opportunityIntelligence.jobId))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.opportunityIntelligence.opportunityScore))
    .limit(6);

  const sections = [
    { title: "🔥 Hidden Gems", data: hiddenGems, emptyMsg: "No hidden gems found yet. The AI is still searching the depths.", icon: "💎", highlightKey: null },
    { title: "💰 Highest Compensation", data: highestComp, emptyMsg: "Awaiting salary data to highlight the best paying roles.", icon: "💸", highlightKey: null },
    { title: "🚀 Fast Growing Companies", data: fastGrowing, emptyMsg: "No hyper-growth companies identified yet.", icon: "📈", highlightKey: "Growth Signal: HIGH" },
    { title: "🌍 Global Remote", data: globalRemote, emptyMsg: "Remote opportunities are currently scarce.", icon: "🌎", highlightKey: "Remote" },
    { title: "🇮🇳 India", data: indiaJobs, emptyMsg: "No opportunities found in India at the moment.", icon: "🇮🇳", highlightKey: null },
    { title: "🧠 AI Companies", data: aiJobs, emptyMsg: "No AI roles found right now.", icon: "🤖", highlightKey: "AI/ML" },
    { title: "⚡ Fast Hiring", data: fastHiring, emptyMsg: "No fast-hiring signals detected yet.", icon: "🏎️", highlightKey: "Hiring Fast" },
    { title: "⭐ Highest Opportunity", data: highestOpportunity, emptyMsg: "Opportunity scores are currently being calculated.", icon: "🎯", highlightKey: null }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Discovery Radar' }]} />
        <h1 className={styles.title}>Discovery Radar</h1>
        <p className={styles.subtitle}>Real-time intelligence on the best opportunities tailored for you.</p>
      </header>

      {sections.map((section, idx) => (
        <section key={idx} className={styles.section}>
          <SectionHeader title={section.title} />
          
          {section.data.length > 0 ? (
            <div className={styles.grid}>
              {section.data.map((job) => (
                <JobCard 
                  key={job.id} 
                  id={job.id}
                  title={job.canonicalTitle || job.normalizedTitle || 'Unknown Role'}
                  company={job.companyName || 'Unknown Company'}
                  salaryMin={job.salaryMin ?? undefined}
                  salaryMax={job.salaryMax ?? undefined}
                  remote={!!job.remoteType}
                  provider={section.highlightKey ? section.highlightKey : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={section.emptyMsg} icon={section.icon} />
          )}
        </section>
      ))}
    </div>
  );
}
