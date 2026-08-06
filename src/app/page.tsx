import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

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
  
  const companiesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
  const totalCompanies = companiesRes[0]?.count || 0;

  return (
    <div>
      <div className="page-header">
        <h2>Overview</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Jobs</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalJobs}</div>
        </div>
        
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>To Apply</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-text)' }}>{applyCount}</div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>To Consider</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning-text)' }}>{considerCount}</div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Companies</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalCompanies}</div>
        </div>
      </div>
      
      {totalJobs === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>No Jobs Found</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem 0' }}>Configure and start a new hunt to discover opportunities.</p>
          <a href="/hunts/new" className="btn btn-primary">Create Hunt Configuration</a>
        </div>
      )}
    </div>
  );
}
