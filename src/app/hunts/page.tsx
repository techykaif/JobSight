import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { InteractiveCard } from '@/components/ui/InteractiveCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function HuntsPage() {
  const runs = await db.select().from(schema.runs).orderBy(desc(schema.runs.createdAt));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Hunts' }]} />
      </div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Hunts</h2>
        <Link href="/hunts/new" className="btn btn-primary" style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', borderRadius: '6px', textDecoration: 'none' }}>New Hunt</Link>
      </div>

      {runs.length === 0 ? (
        <EmptyState 
          title="No hunts created yet." 
          description="Start your first hunt to discover jobs." 
          icon="🔍" 
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {runs.map(run => {
            const variant = run.status === 'RUNNING' ? 'info' : run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral';
            return (
              <InteractiveCard key={run.id} href={`/hunts/${run.id}`} padding="large" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>#{run.id.slice(0, 8)}</span>
                  <StatusBadge status={run.status} variant={variant} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>Stage: {run.currentStage || 'Unknown'}</p>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Created: {new Date(run.createdAt).toLocaleString()}
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
