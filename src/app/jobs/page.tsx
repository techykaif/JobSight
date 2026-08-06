import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await Promise.resolve(searchParams || {});

  // Extract filters
  const decisionFilter = sp.decision as string | undefined;
  const oppScoreFilter = sp.oppScore ? parseInt(sp.oppScore as string) : undefined;
  const minSalaryFilter = sp.salary ? parseInt(sp.salary as string) : undefined;
  const currencyFilter = sp.currency as string | undefined;
  const remoteFilter = sp.remote as string | undefined;
  const countryFilter = sp.country as string | undefined;
  const companyFilter = sp.company as string | undefined;
  const competitionFilter = sp.competition as string | undefined;
  const postingAgeFilter = sp.postingAge ? parseInt(sp.postingAge as string) : undefined;
  const hiddenGemFilter = sp.hiddenGem === 'true';
  const authenticityFilter = sp.authenticity as string | undefined;

  // Fetch data
  const jobs = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.firstSeenAt));
  const decisions = await db.select().from(schema.decisions);
  const scores = await db.select().from(schema.scores);
  const companies = await db.select().from(schema.companies);
  const discoveryIntel = await db.select().from(schema.discoveryIntelligence);
  const jobAnalyses = await db.select().from(schema.jobAnalysis);

  // Apply filters in JS for flexibility across relations
  const filteredJobs = jobs.filter((job) => {
    const decision = decisions.find((d) => d.jobId === job.id);
    const decisionText = decision?.decision || 'PENDING';
    const jobScores = scores.filter((s) => s.jobId === job.id);
    const oppScore = jobScores.find((s) => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue || 0;
    const company = companies.find((c) => c.id === job.companyId);
    const companyName = company?.displayName || '';
    const intel = discoveryIntel.find(i => i.jobId === job.id);
    const analysis = jobAnalyses.find(a => a.jobId === job.id);
    
    const firstSeen = new Date(job.firstSeenAt).getTime();
    const ageDays = (Date.now() - firstSeen) / (1000 * 60 * 60 * 24);

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

  return (
    <div className="jobs-layout">
      <style>{`
        .jobs-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .header-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .header-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-section h2 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(90deg, #fff, #aaa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .premium-container {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }

        .filters-sidebar {
          flex: 0 0 300px;
          background: var(--bg-secondary, rgba(20, 20, 20, 0.6));
          border: 1px solid var(--border-color, #333);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(12px);
          position: sticky;
          top: 24px;
        }

        .filters-sidebar h3 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group {
          margin-bottom: 16px;
        }

        .filter-group label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary, #888);
          margin-bottom: 6px;
          font-weight: 500;
        }

        .filter-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color, #444);
          color: var(--text-primary, #fff);
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        
        .filter-input:focus {
          outline: none;
          border-color: var(--accent-color, #3b82f6);
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }

        .btn-filter {
          width: 100%;
          background: var(--accent-color, #3b82f6);
          color: #fff;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          margin-top: 10px;
        }

        .btn-filter:hover {
          background: var(--accent-hover, #2563eb);
        }
        
        .btn-filter:active {
          transform: scale(0.98);
        }

        .jobs-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 24px;
          text-align: center;
          background: rgba(255,255,255,0.02);
          border: 1px dashed var(--border-color, #444);
          border-radius: 16px;
          grid-column: 1 / -1;
        }

        .empty-state h3 {
          font-size: 1.5rem;
          margin-bottom: 8px;
          color: var(--text-primary, #fff);
        }

        .empty-state p {
          color: var(--text-secondary, #888);
          max-width: 400px;
          margin: 0 auto;
        }
      `}</style>

      <div className="header-section">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Jobs', href: '/jobs' }
        ]} />
        <div className="header-title-row">
          <h2>Jobs Explorer</h2>
          <div className="meta-info">
            <span style={{ fontSize: '0.9rem', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '20px', color: 'var(--text-secondary)' }}>
              {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found
            </span>
          </div>
        </div>
      </div>

      <div className="premium-container">
        <aside className="filters-sidebar">
          <h3>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </h3>
          <form method="GET">
            <div className="filter-group">
              <label>Decision</label>
              <select name="decision" className="filter-input" defaultValue={decisionFilter || 'ALL'}>
                <option value="ALL">All Decisions</option>
                <option value="APPLY">Apply</option>
                <option value="CONSIDER">Consider</option>
                <option value="RESEARCH_REQUIRED">Research Required</option>
                <option value="SKIP">Skip</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Min Opportunity Score</label>
              <input type="number" name="oppScore" className="filter-input" placeholder="e.g. 70" defaultValue={oppScoreFilter || ''} />
            </div>
            
            <div className="filter-group">
              <label>Min Salary</label>
              <input type="number" name="salary" className="filter-input" placeholder="e.g. 100000" defaultValue={minSalaryFilter || ''} />
            </div>

            <div className="filter-group">
              <label>Currency</label>
              <select name="currency" className="filter-input" defaultValue={currencyFilter || 'ALL'}>
                <option value="ALL">Any Currency</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Remote Status</label>
              <select name="remote" className="filter-input" defaultValue={remoteFilter || 'ALL'}>
                <option value="ALL">Any</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">On-site</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Country</label>
              <input type="text" name="country" className="filter-input" placeholder="e.g. US, India..." defaultValue={countryFilter || ''} />
            </div>

            <div className="filter-group">
              <label>Competition</label>
              <select name="competition" className="filter-input" defaultValue={competitionFilter || 'ALL'}>
                <option value="ALL">Any</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Company</label>
              <input type="text" name="company" className="filter-input" placeholder="Search company..." defaultValue={companyFilter || ''} />
            </div>

            <div className="filter-group">
              <label>Authenticity</label>
              <select name="authenticity" className="filter-input" defaultValue={authenticityFilter || 'ALL'}>
                <option value="ALL">Any</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Max Posting Age (days)</label>
              <input type="number" name="postingAge" className="filter-input" placeholder="e.g. 7" defaultValue={postingAgeFilter || ''} />
            </div>

            <div className="filter-group checkbox-group">
              <input type="checkbox" name="hiddenGem" value="true" id="hiddenGem" defaultChecked={hiddenGemFilter} />
              <label htmlFor="hiddenGem" style={{ margin: 0 }}>Hidden Gems Only</label>
            </div>

            <button type="submit" className="btn-filter">Apply Filters</button>
            <Link href="/jobs" style={{ display: 'block', textAlign: 'center', marginTop: '12px', color: 'var(--text-secondary, #aaa)', textDecoration: 'none', fontSize: '0.85rem' }}>
              Clear All
            </Link>
          </form>
        </aside>

        <main className="jobs-grid">
          {filteredJobs.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState 
                title="No jobs found" 
                description="Try adjusting your filters to discover more opportunities, or start a new hunt." 
                icon="📭" 
              />
            </div>
          ) : (
            filteredJobs.map((job) => {
              const decision = decisions.find((d) => d.jobId === job.id);
              const jobScores = scores.filter((s) => s.jobId === job.id);
              const oppV2 = jobScores.find((s) => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue;
              const company = companies.find((c) => c.id === job.companyId);
              const analysis = jobAnalyses.find(a => a.jobId === job.id);
              const firstSeen = new Date(job.firstSeenAt).getTime();
              const ageDays = Math.floor((Date.now() - firstSeen) / (1000 * 60 * 60 * 24));

              const decisionText = decision?.decision || 'PENDING';
              
              const title = job.canonicalTitle || job.normalizedTitle || 'Unknown Role';
              
              return (
                <div key={job.id} style={{ display: 'contents' }}>
                  <JobCard
                    id={job.id}
                    title={title}
                    company={company?.displayName || 'Unknown Company'}
                    salaryMin={job.salaryMin || undefined}
                    salaryMax={job.salaryMax || undefined}
                    remote={job.remoteType === 'REMOTE'}
                    score={oppV2}
                    competition={analysis?.competitionEstimate || undefined}
                    provider={'Unknown'}
                    age={`${ageDays}d ago`}
                    decision={decisionText}
                  />
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
