import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jobs Explorer — JobSight',
  description: 'Explore, filter, and evaluate every opportunity discovered by your hunts.',
};

// ─── Helper: filter select input ─────────────────────────────
function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={`filter-${name}`}
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={defaultValue}
        style={{
          width: '100%',
          padding: '7px 10px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234f5666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '14px',
          paddingRight: 28,
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  name,
  label,
  placeholder,
  defaultValue,
  type = 'text',
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number | undefined;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={`filter-${name}`}
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        id={`filter-${name}`}
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue || ''}
        style={{
          width: '100%',
          padding: '7px 10px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await Promise.resolve(searchParams || {});

  const decisionFilter    = sp.decision as string | undefined;
  const oppScoreFilter    = sp.oppScore ? parseInt(sp.oppScore as string) : undefined;
  const minSalaryFilter   = sp.salary ? parseInt(sp.salary as string) : undefined;
  const currencyFilter    = sp.currency as string | undefined;
  const remoteFilter      = sp.remote as string | undefined;
  const countryFilter     = sp.country as string | undefined;
  const companyFilter     = sp.company as string | undefined;
  const competitionFilter = sp.competition as string | undefined;
  const postingAgeFilter  = sp.postingAge ? parseInt(sp.postingAge as string) : undefined;
  const hiddenGemFilter   = sp.hiddenGem === 'true';
  const authenticityFilter = sp.authenticity as string | undefined;

  const jobs          = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.firstSeenAt));
  const decisions     = await db.select().from(schema.decisions);
  const scores        = await db.select().from(schema.scores);
  const companies     = await db.select().from(schema.companies);
  const discoveryIntel = await db.select().from(schema.discoveryIntelligence);
  const jobAnalyses   = await db.select().from(schema.jobAnalysis);

  const filteredJobs = jobs.filter(job => {
    const decision    = decisions.find(d => d.jobId === job.id);
    const decisionText = decision?.decision || 'PENDING';
    const jobScores   = scores.filter(s => s.jobId === job.id);
    const oppScore    = jobScores.find(s => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue || 0;
    const company     = companies.find(c => c.id === job.companyId);
    const companyName = company?.displayName || '';
    const intel       = discoveryIntel.find(i => i.jobId === job.id);
    const analysis    = jobAnalyses.find(a => a.jobId === job.id);
    const ageDays     = (Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);

    if (decisionFilter && decisionFilter !== 'ALL' && decisionText !== decisionFilter) return false;
    if (oppScoreFilter && oppScore < oppScoreFilter) return false;
    if (minSalaryFilter && (!job.salaryMin || job.salaryMin < minSalaryFilter)) return false;
    if (currencyFilter && currencyFilter !== 'ALL' && job.salaryCurrency !== currencyFilter) return false;
    if (remoteFilter && remoteFilter !== 'ALL' && job.remoteType !== remoteFilter) return false;
    if (countryFilter && countryFilter !== 'ALL' && !job.location?.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (companyFilter && !companyName.toLowerCase().includes(companyFilter.toLowerCase())) return false;
    if (competitionFilter && competitionFilter !== 'ALL' && analysis?.competitionEstimate !== competitionFilter) return false;
    if (postingAgeFilter && ageDays > postingAgeFilter) return false;
    if (hiddenGemFilter && !intel?.hiddenGem) return false;
    if (authenticityFilter && authenticityFilter !== 'ALL' && intel?.authenticity !== authenticityFilter) return false;

    return true;
  });

  const hasActiveFilters = !!(decisionFilter || oppScoreFilter || minSalaryFilter || currencyFilter ||
    remoteFilter || countryFilter || companyFilter || competitionFilter || postingAgeFilter ||
    hiddenGemFilter || authenticityFilter);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Jobs Explorer' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Jobs Explorer
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {filteredJobs.length} {filteredJobs.length === 1 ? 'opportunity' : 'opportunities'}{hasActiveFilters ? ' matching filters' : ' discovered'}
            </p>
          </div>
          {hasActiveFilters && (
            <Link href="/jobs" className="btn" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Layout: filter sidebar + jobs grid */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Filter sidebar */}
        <aside
          aria-label="Job filters"
          style={{
            flexShrink: 0,
            width: 256,
            position: 'sticky',
            top: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
            </h2>
            {hasActiveFilters && (
              <span style={{
                background: 'var(--accent-glow)',
                color: 'var(--info)',
                border: '1px solid var(--info-border)',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 7px',
              }}>Active</span>
            )}
          </div>

          <form method="GET" style={{ display: 'flex', flexDirection: 'column' }}>
            <FilterSelect
              name="decision"
              label="Decision"
              defaultValue={decisionFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'All Decisions' },
                { value: 'APPLY', label: '✓ Apply' },
                { value: 'CONSIDER', label: '◷ Consider' },
                { value: 'RESEARCH_REQUIRED', label: '⎋ Research' },
                { value: 'SKIP', label: '✕ Skip' },
                { value: 'PENDING', label: '· Pending' },
              ]}
            />

            <FilterInput
              name="oppScore"
              label="Min Opportunity Score"
              placeholder="e.g. 70"
              defaultValue={oppScoreFilter}
              type="number"
            />

            <FilterInput
              name="salary"
              label="Min Salary"
              placeholder="e.g. 100000"
              defaultValue={minSalaryFilter}
              type="number"
            />

            <FilterSelect
              name="currency"
              label="Currency"
              defaultValue={currencyFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any Currency' },
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
                { value: 'GBP', label: 'GBP' },
                { value: 'INR', label: 'INR' },
              ]}
            />

            <FilterSelect
              name="remote"
              label="Remote Status"
              defaultValue={remoteFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'REMOTE', label: 'Remote' },
                { value: 'HYBRID', label: 'Hybrid' },
                { value: 'ONSITE', label: 'On-site' },
              ]}
            />

            <FilterInput
              name="country"
              label="Country / Location"
              placeholder="e.g. US, India..."
              defaultValue={countryFilter}
            />

            <FilterInput
              name="company"
              label="Company"
              placeholder="Search company..."
              defaultValue={companyFilter}
            />

            <FilterSelect
              name="competition"
              label="Competition"
              defaultValue={competitionFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
              ]}
            />

            <FilterSelect
              name="authenticity"
              label="Authenticity"
              defaultValue={authenticityFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'HIGH', label: 'High' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LOW', label: 'Low' },
              ]}
            />

            <FilterInput
              name="postingAge"
              label="Max Posting Age (days)"
              placeholder="e.g. 7"
              defaultValue={postingAgeFilter}
              type="number"
            />

            {/* Hidden Gems toggle */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8px 10px',
                background: hiddenGemFilter ? 'var(--info-bg)' : 'var(--bg-base)',
                border: `1px solid ${hiddenGemFilter ? 'var(--info-border)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.15s ease',
              }}>
                <input
                  type="checkbox"
                  name="hiddenGem"
                  value="true"
                  id="hiddenGem"
                  defaultChecked={hiddenGemFilter}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: hiddenGemFilter ? 'var(--info)' : 'var(--text-secondary)', fontWeight: 500 }}>
                  Hidden Gems Only
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.875rem', padding: '9px 0' }}
            >
              Apply Filters
            </button>

            {hasActiveFilters && (
              <Link
                href="/jobs"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 10,
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  transition: 'color 0.15s',
                }}
              >
                Clear all filters
              </Link>
            )}
          </form>
        </aside>

        {/* Jobs grid */}
        <main
          aria-label="Job listings"
          style={{ flex: 1, minWidth: 0 }}
        >
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="No jobs match your filters"
              description="Try adjusting your filters to discover more opportunities, or start a new hunt to find fresh roles."
              icon="📭"
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              {filteredJobs.map(job => {
                const decision  = decisions.find(d => d.jobId === job.id);
                const jobScores = scores.filter(s => s.jobId === job.id);
                const oppV2     = jobScores.find(s => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue;
                const company   = companies.find(c => c.id === job.companyId);
                const analysis  = jobAnalyses.find(a => a.jobId === job.id);
                const ageDays   = Math.floor((Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24));
                const title     = job.canonicalTitle || job.normalizedTitle || 'Unknown Role';

                return (
                  <JobCard
                    key={job.id}
                    id={job.id}
                    title={title}
                    company={company?.displayName || 'Unknown Company'}
                    salaryMin={job.salaryMin || undefined}
                    salaryMax={job.salaryMax || undefined}
                    remote={job.remoteType === 'REMOTE' || job.remoteType === 'FULLY_REMOTE'}
                    score={oppV2}
                    competition={analysis?.competitionEstimate || undefined}
                    age={ageDays === 0 ? 'Today' : `${ageDays}d ago`}
                    decision={decision?.decision || 'PENDING'}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
