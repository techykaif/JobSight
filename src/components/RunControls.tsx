'use client'

import { useState, useEffect } from 'react';

export default function RunControls({ runId, initialStatus }: { runId: string, initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple polling to keep status up to date if we miss an SSE update
  useEffect(() => {
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/control`);
        const data = await res.json();
        if (data.activeRunId === runId) {
          if (data.isPauseRequested) setStatus('PAUSED');
          else setStatus('RUNNING');
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [runId, status]);

  const sendAction = async (action: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      if (action === 'START' || action === 'RESUME') setStatus('RUNNING');
      if (action === 'PAUSE') setStatus('PAUSED');
      if (action === 'CANCEL') setStatus('CANCELLING');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Mission Controls</h3>
        <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{status}</span>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {status === 'CREATED' && <button onClick={() => sendAction('START')} disabled={loading} className="btn btn-primary">Start Mission</button>}
          {status === 'RUNNING' && <button onClick={() => sendAction('PAUSE')} disabled={loading} className="btn">Pause</button>}
          {status === 'PAUSED' && <button onClick={() => sendAction('RESUME')} disabled={loading} className="btn btn-primary">Resume</button>}
          {(status === 'RUNNING' || status === 'PAUSED' || status === 'CREATED') && <button onClick={() => sendAction('CANCEL')} disabled={loading} className="btn" style={{ color: 'var(--danger-text)' }}>Cancel</button>}
        </div>
      </div>
      {error && <div style={{ color: 'var(--danger-text)', marginTop: '1rem' }}>{error}</div>}
    </div>
  );
}
