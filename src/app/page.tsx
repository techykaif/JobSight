import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';

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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} className="mb-6" />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 600, background: 'linear-gradient(to right, var(--text-main), var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Intelligence Dashboard
        </h2>
        <Link href="/hunts/new" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', textDecoration: 'none', fontWeight: 500, transition: 'transform 0.2s, box-shadow 0.2s' }}>
          Start New Hunt
        </Link>
      </div>

      {totalJobs === 0 ? (
        <EmptyState 
          title="No jobs found yet" 
          description="Start your first hunt to discover opportunities, research companies, and find your dream role." 
          icon="🚀" 
        />
      ) : (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
          <MetricCard href="/jobs" label="Jobs Found" value={totalJobs} trend={{ value: 12, isPositive: true }} icon={<span style={{ fontSize: '1.25rem' }}>🔍</span>} />

          <MetricCard href="/jobs" label="Qualified Jobs" value={qualifiedJobs} trend={{ value: 8, isPositive: true }} icon={<span style={{ fontSize: '1.25rem' }}>🎯</span>} />

          <MetricCard href="/board" label="Apply Now" value={applyCount} icon={<span style={{ fontSize: '1.25rem', color: 'var(--success-text)' }}>🚀</span>} />

          <MetricCard href="/board" label="Apply This Week" value={considerCount} icon={<span style={{ fontSize: '1.25rem', color: 'var(--warning-text)' }}>📅</span>} />

          <MetricCard href="/board" label="Monitor" value={monitorCount} icon={<span style={{ fontSize: '1.25rem', color: 'var(--accent-color)' }}>👀</span>} />

          <MetricCard href="/radar" label="Hidden Gems" value={hiddenGems} icon={<span style={{ fontSize: '1.25rem' }}>💎</span>} />

          <MetricCard href="/jobs?sort=salary_desc" label="Highest Salary" value={highestSalaryFormatted} icon={<span style={{ fontSize: '1.25rem' }}>💰</span>} />

          <MetricCard href="/radar" label="Lowest Competition" value={lowestCompetition} icon={<span style={{ fontSize: '1.25rem' }}>🏃</span>} />

          <MetricCard href="/companies" label="Companies Researched" value={totalCompanies} icon={<span style={{ fontSize: '1.25rem' }}>🏢</span>} />

          <MetricCard href="/radar" label="Avg Opportunity Score" value={avgOpportunityScore > 0 ? `${avgOpportunityScore}/100` : 'N/A'} icon={<span style={{ fontSize: '1.25rem' }}>⭐</span>} />
        </div>
      )}
    </div>
  );
}
