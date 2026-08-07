import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { InteractiveCard } from '@/components/ui/InteractiveCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hunts — JobSight',
  description: 'View and manage all your active and completed intelligence hunts.',
};

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  RUNNING:   'var(--info)',
  COMPLETED: 'var(--success-text)',
  FAILED:    'var(--danger-text)',
  CANCELLED: 'var(--text-muted)',
  PENDING:   'var(--warning-text)',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  RUNNING:   '#3b82f6',
  COMPLETED: '#10b981',
  FAILED:    '#ef4444',
  CANCELLED: '#6b7280',
  PENDING:   '#f59e0b',
};

export default async function HuntsPage() {
  const runs = await db.select().from(schema.runs).orderBy(desc(schema.runs.createdAt));

  const runningCount = runs.filter(r => r.status === 'RUNNING').length;
  const completedCount = runs.filter(r => r.status === 'COMPLETED').length;
  const failedCount = runs.filter(r => r.status === 'FAILED').length;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', animation: 'fadeIn 0.35s ease-out' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Hunts' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Hunts
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {runs.length} total — {runningCount} running, {completedCount} completed
            </p>
          </div>
          <Link
            href="/hunts/new"
            className="btn btn-primary"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: '0.875rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Hunt
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      {runs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {[
            { label: 'Running', value: runningCount, color: STATUS_DOT_COLORS.RUNNING },
            { label: 'Completed', value: completedCount, color: STATUS_DOT_COLORS.COMPLETED },
            { label: 'Failed', value: failedCount, color: STATUS_DOT_COLORS.FAILED },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: stat.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)' }}>{stat.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {runs.length === 0 ? (
        <div style={{ maxWidth: 480, margin: '60px auto' }}>
          <EmptyState
            title="No hunts yet"
            description="Start your first intelligence hunt to discover opportunities across multiple job boards simultaneously."
            icon="🔭"
            action={
              <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Launch First Hunt
              </Link>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {runs.map(run => {
            const variant = run.status === 'RUNNING' ? 'info' : run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral';
            const dotColor = STATUS_DOT_COLORS[run.status] || '#6b7280';
            const isRunning = run.status === 'RUNNING';

            return (
              <InteractiveCard
                key={run.id}
                href={`/hunts/${run.id}`}
                padding="none"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                {/* Status bar top */}
                {isRunning && (
                  <div style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${dotColor}, transparent)`,
                    animation: 'shimmer 2s infinite',
                  }} />
                )}

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: isRunning ? `0 0 6px ${dotColor}` : 'none' }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.04em',
                      }}>
                        #{run.id.slice(0, 8)}
                      </span>
                    </div>
                    <StatusBadge status={run.status} variant={variant} />
                  </div>

                  {/* Stage info */}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      {run.currentStage ? run.currentStage.replace(/_/g, ' ') : 'Not started'}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {timeAgo(run.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View details</span>
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
