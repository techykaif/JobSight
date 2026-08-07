import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { InteractiveCard } from '@/components/ui/InteractiveCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Companies — JobSight',
  description: 'Researched companies with hiring intelligence, authenticity scores, and growth signals.',
};

export default async function CompaniesPage() {
  const companies = await db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt));
  const jobs = await db.select().from(schema.jobs);
  const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.workerType, 'STRUCTURE_COMPANY_RESEARCH'));

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', animation: 'fadeIn 0.35s ease-out' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Companies' }]} />
        <div style={{ marginTop: 16 }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Companies
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {companies.length} companies researched — click to view intelligence report
          </p>
        </div>
      </div>

      {companies.length === 0 ? (
        <div style={{ maxWidth: 480, margin: '60px auto' }}>
          <EmptyState
            title="No companies researched yet"
            description="Companies are automatically discovered and researched during your hunts. Start a hunt to populate this page."
            icon="🏢"
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {companies.map(comp => {
            const compJobs = jobs.filter(j => j.companyId === comp.id);
            const compArtifact = artifacts.find(a => a.entityId === comp.id);
            const isResearched = !!compArtifact;
            const domain = comp.website
              ? comp.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
              : null;

            return (
              <InteractiveCard
                key={comp.id}
                href={`/companies/${comp.id}`}
                padding="none"
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ padding: '20px', flex: 1 }}>
                  {/* Company name + research badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3,
                    }}>
                      {comp.displayName}
                    </h3>
                    {isResearched && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        background: 'var(--success-bg)',
                        color: 'var(--success-text)',
                        border: '1px solid var(--success-border)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        flexShrink: 0,
                      }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>

                  {/* Website */}
                  {domain && (
                    <p style={{
                      margin: '0 0 12px',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                      {domain}
                    </p>
                  )}

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {compJobs.length}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>Open Jobs</div>
                    </div>
                    {isResearched && (
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                          {new Date(compArtifact!.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>Last Researched</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: '10px 20px',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View intelligence report</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </InteractiveCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
