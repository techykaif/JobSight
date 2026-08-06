import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { InteractiveCard } from '@/components/ui/InteractiveCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function CompaniesPage() {
  const companies = await db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt));
  const jobs = await db.select().from(schema.jobs);
  const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.workerType, 'STRUCTURE_COMPANY_RESEARCH'));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Companies' }]} />
      </div>

      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>Companies</h2>
      </div>

      {companies.length === 0 ? (
        <EmptyState 
          title="No companies found." 
          description="We haven't discovered any companies yet." 
          icon="🏢" 
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {companies.map(comp => {
            const compJobs = jobs.filter(j => j.companyId === comp.id);
            const compArtifact = artifacts.find(a => a.entityId === comp.id);
            
            return (
              <InteractiveCard key={comp.id} href={`/companies/${comp.id}`} padding="large" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{comp.displayName}</h3>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>
                    {comp.website ? <span style={{ color: 'var(--text-muted)' }}>{comp.website}</span> : 'No website'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    <strong>{compJobs.length}</strong> Open Jobs
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {compArtifact ? `Researched ${new Date(compArtifact.createdAt).toLocaleDateString()}` : 'Not researched'}
                  </p>
                </div>
              </InteractiveCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
