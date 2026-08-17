'use client';

import { useState, useEffect, useRef } from 'react';

const icons = {
  JOB_DISCOVERED: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  ),
  COMPANY_RESEARCH: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  DECISION_ACCEPT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  DECISION_REJECT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  RANKING: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"></line>
      <line x1="18" y1="20" x2="18" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="16"></line>
    </svg>
  ),
  FINISHED: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  DEFAULT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  )
};

function getEventIcon(eventType: string) {
  if (eventType.includes('DECISION') && eventType.includes('ACCEPT')) return icons.DECISION_ACCEPT;
  if (eventType.includes('DECISION') && eventType.includes('REJECT')) return icons.DECISION_REJECT;
  if (eventType.includes('DISCOVER')) return icons.JOB_DISCOVERED;
  if (eventType.includes('RESEARCH')) return icons.COMPANY_RESEARCH;
  if (eventType.includes('RANK') || eventType.includes('SCORE')) return icons.RANKING;
  if (eventType.includes('FINISHED') || eventType.includes('COMPLETE')) return icons.FINISHED;
  return icons.DEFAULT;
}

function getEventColor(eventType: string) {
  if (eventType.includes('DECISION') && eventType.includes('ACCEPT')) return 'var(--success-color)';
  if (eventType.includes('DECISION') && eventType.includes('REJECT')) return 'var(--danger-color)';
  if (eventType.includes('RESEARCH')) return 'var(--accent-color)';
  if (eventType.includes('RANK')) return 'var(--warning-color)';
  return 'var(--border-color)';
}

export function humanizeEventName(eventType: string): string {
  const map: Record<string, string> = {
    'RUN_STARTED': 'Run Started',
    'PREFLIGHT_STARTED': 'Preflight',
    'DISCOVERY_STARTED': 'Discovery',
    'STRATEGY_STARTED': 'Discovery Strategy',
    'SOURCE_RESOLUTION_COMPLETED': 'Sources Resolved',
    'PROVIDER_STARTED': 'Provider Started',
    'HEARTBEAT': 'Waiting for Provider',
    'PROVIDER_COMPLETED': 'Provider Completed',
    'STRATEGY_COMPLETED': 'Discovery Complete',
    'STAGE_B_TELEMETRY': 'Structuring',
    'DISCOVERY_BATCH_COMPLETED': 'Discovery Complete',
    'QUALIFICATION_STARTED': 'Qualification',
    'COMPANY_RESEARCH_SKIPPED': 'Company Research Skipped',
    'FOUNDATION_STARTED': 'Foundation',
    'COMPETITION_STARTED': 'Competition',
    'COMPANY_OPPORTUNITY_STARTED': 'Opportunity',
    'DISCOVERY_INTELLIGENCE_STARTED': 'Discovery Intelligence',
    'APPLICATION_INTELLIGENCE_STARTED': 'Application Intelligence',
    'RUN_COMPLETED': 'Run Completed'
  };
  if (map[eventType]) return map[eventType];
  return eventType.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

export default function LiveEventFeed({ 
  runId,
  initialStatus,
  initialElapsed
}: { 
  runId: string,
  initialStatus?: string,
  initialElapsed?: number
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [statusInfo, setStatusInfo] = useState<any>(initialStatus ? { status: initialStatus, stage: '' } : null);
  const [elapsed, setElapsed] = useState<number>(initialElapsed || 0);
  
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isTerminal = statusInfo?.status === 'COMPLETED' || statusInfo?.status === 'FAILED' || statusInfo?.status === 'CANCELLED';
    if (connected && !isTerminal) {
      timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [connected, statusInfo]);

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/events`);
    
    es.onopen = () => setConnected(true);
    
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'STREAM_CLOSED') {
        es.close();
        setConnected(false);
        return;
      }
      if (data.type === 'METRICS') {
        setMetrics(data.metrics);
        if (data.metrics.elapsedTime && statusInfo?.status !== 'COMPLETED' && statusInfo?.status !== 'FAILED' && statusInfo?.status !== 'CANCELLED') {
          setElapsed(Math.floor(data.metrics.elapsedTime / 1000));
        }
        return;
      }
      if (data.type === 'STATUS') {
        setStatusInfo({ status: data.status, stage: data.stage });
        return;
      }
      setEvents(prev => {
        if (prev.find(x => x.id === data.id)) return prev;
        return [...prev, data].slice(-100); // keep last 100
      });
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => es.close();
  }, [runId, statusInfo?.status]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const currentProvider = events.length > 0 ? [...events].reverse().find(e => e.payload?.provider)?.payload?.provider : null;

  return (
    <div style={{ marginTop: '3rem' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .live-pulse {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--success-text);
          box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.7);
          animation: pulse 2s infinite;
          margin-left: 8px;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(63, 185, 80, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
        }
        .progress-bar-container {
          width: 100%;
          background-color: var(--bg-tertiary);
          border-radius: 4px;
          height: 8px;
          overflow: hidden;
          margin-top: 8px;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), #8a2be2);
          transition: width 0.3s ease;
        }
        .event-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.2s;
        }
        .event-card:last-child {
          border-bottom: none;
        }
        .event-card:hover {
          background: var(--bg-subtle);
        }
        .event-icon {
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      `}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.125rem', fontWeight: 600 }}>
          Live Pipeline {connected && statusInfo?.status === 'RUNNING' && <span className="live-pulse"></span>}
        </h3>
        {elapsed > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
          </div>
        )}
      </div>

      {statusInfo && (
        <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '4px' }}>Current Stage</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{statusInfo.stage || 'INITIALIZING'}</div>
            </div>
            {currentProvider && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '4px' }}>Active Provider</div>
                <div style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 500 }}>{currentProvider}</div>
              </div>
            )}
          </div>
          
          <div className="progress-bar-container">
             <div className="progress-bar-fill" style={{ width: statusInfo.status === 'COMPLETED' ? '100%' : '65%', animation: statusInfo.status === 'RUNNING' ? 'pulse 2s infinite' : 'none' }}></div>
          </div>
        </div>
      )}

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div style={{ padding: 'var(--space-4)', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Providers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{metrics.providersUsed || 0}</div>
          </div>
          <div style={{ padding: 'var(--space-4)', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Jobs Found</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{metrics.jobsFound || 0}</div>
          </div>
          <div style={{ padding: 'var(--space-4)', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Accepted</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--success-text)' }}>{metrics.accepted || 0}</div>
          </div>
          <div style={{ padding: 'var(--space-4)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Rejected</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger-text)' }}>{metrics.rejected || 0}</div>
          </div>
        </div>
      )}

      <div style={{ 
        padding: 'var(--space-3)', 
        borderRadius: 'var(--radius-lg)',
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {events.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><p>Waiting for pipeline events...</p></div>}
        
        {events.map((ev, i) => {
          const bg = getEventColor(ev.eventType);
          
          return (
            <div key={ev.id || i} className="event-card">
              <div className="event-icon" style={{ backgroundColor: bg + '20', color: bg }}>
                {getEventIcon(ev.eventType)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{humanizeEventName(ev.eventType)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.payload?.message || (ev.eventType === 'HEARTBEAT' ? 'Waiting for provider response...' : `${humanizeEventName(ev.eventType)} in progress...`)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
