import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
  const comp = compRec[0];

  if (!comp) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
        <EmptyState 
          title="Company Not Found" 
          description="We couldn't locate the requested company profile." 
          icon="🏢" 
          action={<Link href="/companies"><ActionButton variant="primary">Back to Companies</ActionButton></Link>} 
        />
      </div>
    );
  }

  // Fetch Jobs
  const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, comp.id)).orderBy(desc(schema.jobs.firstSeenAt));
  
  // Fetch Artifacts
  const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.entityId, comp.id)).orderBy(desc(schema.researchArtifacts.createdAt)).limit(1);
  const artifact = artifacts[0];

  // Fetch Analysis
  const analysisRecs = await db.select().from(schema.companyAnalysis).where(eq(schema.companyAnalysis.companyId, comp.id)).orderBy(desc(schema.companyAnalysis.researchTimestamp)).limit(1);
  const analysis = analysisRecs[0];

  // Fetch Intelligence and Sources for these jobs
  let jobIntel: typeof schema.discoveryIntelligence.$inferSelect[] = [];
  let jobSources: typeof schema.jobSources.$inferSelect[] = [];
  
  if (jobs.length > 0) {
    const jobIds = jobs.map(j => j.id);
    
    // Chunking to avoid too many variables in SQLite if large
    const chunks = [];
    for (let i = 0; i < jobIds.length; i += 50) {
      chunks.push(jobIds.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const intelChunk = await db.select().from(schema.discoveryIntelligence).where(inArray(schema.discoveryIntelligence.jobId, chunk));
      jobIntel.push(...intelChunk);

      const sourcesChunk = await db.select().from(schema.jobSources).where(inArray(schema.jobSources.jobId, chunk));
      jobSources.push(...sourcesChunk);
    }
  }

  // Process data
  let research: any = null;
  if (artifact && artifact.metadata) {
    try {
      const parsed = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
      research = parsed?.structuredData || null;
    } catch(e) {}
  }

  const activeJobs = jobs.filter(j => j.status === 'ACTIVE').length;
  
  // Averages from intel
  let avgAuthenticity = 0;
  let hiddenGemCount = 0;
  if (jobIntel.length > 0) {
    let authSum = 0;
    let authCount = 0;
    jobIntel.forEach(intel => {
      if (intel.authenticity) {
        // Try to parse if it's a numeric string like "85"
        const val = parseInt(intel.authenticity.toString(), 10);
        if (!isNaN(val)) {
          authSum += val;
          authCount++;
        }
      }
      if (intel.hiddenGem) {
        hiddenGemCount++;
      }
    });
    if (authCount > 0) avgAuthenticity = Math.round(authSum / authCount);
  }

  // Source types breakdown
  const sourceTypes = jobSources.reduce((acc, src) => {
    acc[src.sourceType] = (acc[src.sourceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      <div style={{ marginBottom: '1rem' }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Companies', href: '/companies' }, { label: comp.displayName }]} />
      </div>

      {/* Hero Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{comp.displayName}</h1>
            {avgAuthenticity > 80 && (
              <span style={{ background: 'var(--success-color, #10b981)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600 }}>
                ✓ Highly Authentic
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)' }}>
            {comp.website && (
              <a href={comp.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🌐 Website
              </a>
            )}
            {comp.careersUrl && (
              <a href={comp.careersUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💼 Careers Page
              </a>
            )}
          </div>
        </div>
        <Link href="/companies" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.75rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 500 }}>
          ← Back
        </Link>
      </div>

      {/* Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        <MetricCard icon="📊" label="Hiring Momentum" value={analysis?.hiringMomentum || 'Neutral'} />
        <MetricCard icon="💼" label="Open Roles" value={activeJobs.toString()} />
        <MetricCard href={`/jobs?remote=${analysis?.remoteFriendliness || 'Unknown'}`} icon="🌍" label="Remote Policy" value={analysis?.remoteFriendliness || (research?.hiring?.remoteOpenings ? 'Remote Friendly' : 'Unknown')} />
        <MetricCard icon="💰" label="Funding" value={research?.companyInfo?.funding || 'Unknown'} />
        <MetricCard icon="👥" label="Company Size" value={research?.companyInfo?.size || 'Unknown'} />
        <MetricCard icon="💎" label="Hidden Gems" value={hiddenGemCount.toString()} />
        
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* Main Jobs Table */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Posting History</h3>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Sorted by latest</span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Location</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>First Seen</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</div>
                      No jobs observed yet. Start your first hunt!
                    </td>
                  </tr>
                ) : (
                  jobs.map(job => (
                    <tr key={job.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                        <Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                          {job.canonicalTitle || job.normalizedTitle}
                        </Link>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>
                        <Link href={`/jobs?location=${job.location || job.remoteType || 'Unknown'}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          {job.location || job.remoteType || 'Unknown'}
                        </Link>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <StatusBadge status={job.status} variant={job.status === 'ACTIVE' ? 'success' : 'neutral'} />
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {new Date(job.firstSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Intel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Observed Sources</h3>
            {Object.keys(sourceTypes).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No sources recorded.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(sourceTypes).map(([type, count]) => (
                  <li key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href={`/jobs?provider=${type}`} style={{ fontWeight: 500, color: 'var(--accent-color)', textDecoration: 'none' }}>
                      {type.replace(/_/g, ' ')}
                    </Link>
                    <span style={{ background: 'var(--bg-primary)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem' }}>{count} observed</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Intelligence Snapshots</h3>
            {analysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <IntelRow label="Growth Signal" value={analysis.growthSignal || 'N/A'} />
                <IntelRow label="Layoff Signal" value={analysis.layoffSignal || 'N/A'} />
                <IntelRow label="Eng. Hiring" value={analysis.engineeringHiringActivity || 'N/A'} />
                <p style={{ margin: '1rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                  Updated {new Date(analysis.researchTimestamp).toLocaleDateString()}
                </p>
              </div>
            ) : (
               <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No deep analysis run yet.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

function IntelRow({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{value.toLowerCase()}</span>
    </div>
  );
}
