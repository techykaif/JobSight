import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — JobSight',
  description: 'Your real-time intelligence dashboard. See what deserves attention today.',
};

export default async function DashboardPage() {
  const jobsCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.jobs);
  const totalJobs = jobsCountRes[0]?.count || 0;

  const decisionsRes = await db.select({
    decision: schema.decisions.decision,
    count: sql<number>`count(*)`
  }).from(schema.decisions).groupBy(schema.decisions.decision);

  const applyCount = decisionsRes.find(d => d.decision === 'APPLY')?.count || 0;
  const considerCount = decisionsRes.find(d => d.decision === 'CONSIDER')?.count || 0;
  const skipCount = decisionsRes.find(d => d.decision === 'SKIP')?.count || 0;

  const qualifiedJobs = totalJobs - skipCount;

  const watchlistsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.watchlists);
  const monitorCount = watchlistsRes[0]?.count || 0;

  const hiddenGemsRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.discoveryIntelligence)
    .where(eq(schema.discoveryIntelligence.hiddenGem, true));
  const hiddenGems = hiddenGemsRes[0]?.count || 0;

  const maxSalaryRes = await db.select({ maxSal: sql<number>`max(${schema.jobs.salaryMax})` }).from(schema.jobs);
  const highestSalary = maxSalaryRes[0]?.maxSal || 0;

  const lowCompRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.discoveryIntelligence)
    .where(eq(schema.discoveryIntelligence.competition, 'LOW'));
  const lowestCompetition = lowCompRes[0]?.count || 0;

  const companiesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
  const totalCompanies = companiesRes[0]?.count || 0;

  const avgOppRes = await db.select({ avg: sql<number>`avg(${schema.opportunityIntelligence.opportunityScore})` }).from(schema.opportunityIntelligence);
  const avgOpportunityScore = Math.round(avgOppRes[0]?.avg || 0);

  const highestSalaryFormatted = highestSalary > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(highestSalary)
    : 'N/A';

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              Intelligence Dashboard
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              What deserves your attention today?
            </p>
          </div>
          <Link
            href="/hunts/new"
            className="btn btn-primary"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: '0.875rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Start New Hunt
          </Link>
        </div>
      </div>

      {totalJobs === 0 ? (
        <div style={{ maxWidth: 560, margin: '80px auto' }}>
          <EmptyState
            title="No opportunities discovered yet"
            description="Start your first hunt to scan job boards, research companies, and surface hidden opportunities matched to your profile."
            icon="🔭"
            action={
              <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Launch First Hunt
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Section: Today's Priorities */}
          <section aria-label="Today's priorities" style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Action Required
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/board"
                label="Apply Now"
                value={applyCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }
              />
              <MetricCard
                href="/board"
                label="Apply This Week"
                value={considerCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                }
              />
              <MetricCard
                href="/board"
                label="Monitor"
                value={monitorCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              />
            </div>
          </section>

          {/* Section: Intelligence Overview */}
          <section aria-label="Intelligence overview" style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Intelligence Overview
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/jobs"
                label="Jobs Found"
                value={totalJobs}
                trend={{ value: 12, isPositive: true }}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                }
              />
              <MetricCard
                href="/jobs"
                label="Qualified Jobs"
                value={qualifiedJobs}
                trend={{ value: 8, isPositive: true }}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Hidden Gems"
                value={hiddenGems}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Low Competition"
                value={lowestCompetition}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                }
              />
            </div>
          </section>

          {/* Section: Portfolio Overview */}
          <section aria-label="Portfolio overview">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Portfolio
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/jobs?sort=salary_desc"
                label="Highest Salary"
                value={highestSalaryFormatted}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                }
              />
              <MetricCard
                href="/companies"
                label="Companies Researched"
                value={totalCompanies}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Avg Opportunity Score"
                value={avgOpportunityScore > 0 ? `${avgOpportunityScore}/100` : 'N/A'}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                }
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
