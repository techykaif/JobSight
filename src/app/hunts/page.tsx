import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { InteractiveCard } from '@/components/ui/InteractiveCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
    <div className="profile-workspace" style={{ animation: 'fadeIn 0.35s ease-out', maxWidth: '1100px' }}>
      
      {/* 1. Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-5)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Hunts</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Mission control. Manage your automated intelligence operations.
          </p>
        </div>
        <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.8125rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Hunt
        </Link>
      </div>

      {/* 2. Summary Metrics (Compact Telemetry Strip) */}
      {runs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-6)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {[
            { label: 'Running', value: runningCount, color: STATUS_DOT_COLORS.RUNNING },
            { label: 'Completed', value: completedCount, color: STATUS_DOT_COLORS.COMPLETED },
            { label: 'Failed', value: failedCount, color: STATUS_DOT_COLORS.FAILED },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: stat.color, flexShrink: 0, boxShadow: stat.label === 'Running' ? `0 0 6px ${stat.color}` : 'none' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Hunt Grid */}
      {runs.length === 0 ? (
        <div className="profile-empty-state">
          <div className="profile-empty-icon" aria-hidden="true">🔭</div>
          <h3>No hunts yet</h3>
          <p>Start your first intelligence hunt to discover opportunities across multiple job boards simultaneously.</p>
          <div className="profile-empty-actions">
            <Link href="/hunts/new" className="btn btn-primary">Launch First Hunt</Link>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-4)'
        }}>
          {runs.map(run => {
            const variant = run.status === 'RUNNING' ? 'info' : run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral';
            const dotColor = STATUS_DOT_COLORS[run.status] || '#6b7280';
            const isRunning = run.status === 'RUNNING';

            return (
              <InteractiveCard
                key={run.id}
                href={`/hunts/${run.id}`}
                padding="none"
                className="profile-card"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                {/* Status bar top indicator */}
                {isRunning && (
                  <div style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${dotColor}, transparent)`,
                    animation: 'shimmer 2s infinite',
                  }} />
                )}

                <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', flex: 1, gap: 'var(--space-3)' }}>
                  
                  {/* Card Header: Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: isRunning ? `0 0 6px ${dotColor}` : 'none' }} />
                      <StatusBadge status={run.status.replace(/_/g, ' ')} variant={variant} />
                    </div>
                  </div>

                  {/* Stage Info & Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {run.currentStage ? run.currentStage.replace(/_/g, ' ') : 'Not started'}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                        #{run.id.slice(0, 8)}
                      </div>
                      <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {timeAgo(run.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Action */}
                <div style={{
                  padding: '8px var(--space-3)',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginTop: 'auto',
                  transition: 'background var(--transition-fast)',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>View Mission Telemetry</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
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
