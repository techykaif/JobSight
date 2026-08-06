'use client'

import { useState, useEffect } from 'react';

export default function LiveEventFeed({ runId }: { runId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  const [metrics, setMetrics] = useState<any>(null);
  const [statusInfo, setStatusInfo] = useState<any>(null);

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
        return;
      }
      if (data.type === 'STATUS') {
        setStatusInfo({ status: data.status, stage: data.stage });
        return;
      }
      setEvents(prev => {
        if (prev.find(x => x.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(() => {
        // Reconnect logic
      }, 5000);
    };

    return () => es.close();
  }, [runId]);

  return (
    <div style={{ marginTop: '2rem' }}>
      {statusInfo && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0 }}>Live Status</h3>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div><strong>Status:</strong> {statusInfo.status}</div>
            <div><strong>Stage:</strong> {statusInfo.stage}</div>
          </div>
        </div>
      )}

      {metrics && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0 }}>Discovery Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div><strong>Providers Used:</strong> {metrics.providersUsed}</div>
            <div><strong>Sources Attempted:</strong> {metrics.sourcesAttempted}</div>
            <div><strong>Sources Completed:</strong> {metrics.sourcesCompleted}</div>
            <div><strong>Jobs Found:</strong> {metrics.jobsFound}</div>
            <div><strong>Qualified:</strong> {metrics.qualified}</div>
            <div><strong>Accepted:</strong> {metrics.accepted}</div>
            <div><strong>Rejected:</strong> {metrics.rejected}</div>
            <div><strong>Research Complete:</strong> {metrics.researchComplete}</div>
            <div><strong>Elapsed:</strong> {Math.floor(metrics.elapsedTime / 1000)}s</div>
          </div>
        </div>
      )}

      <h3>Live Event Feed {connected && <span style={{ fontSize: '0.8rem', color: 'var(--success-text)' }}>● Live</span>}</h3>
      <div style={{ 
        backgroundColor: '#000', 
        color: '#0f0', 
        fontFamily: 'monospace', 
        padding: '1rem', 
        borderRadius: '6px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {events.length === 0 && <div style={{ color: '#888' }}>Waiting for events...</div>}
        {events.map(ev => (
          <div key={ev.id} style={{ marginBottom: '0.25rem' }}>
            <span style={{ color: '#888' }}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: '#aaa', marginLeft: '1rem', width: '100px', display: 'inline-block' }}>{ev.stage}</span>
            <span style={{ marginLeft: '1rem' }}>
              {ev.payload?.message || ev.eventType} 
              {ev.entityId && <span style={{ color: '#08f' }}> [{ev.entityId.slice(0, 8)}]</span>}
              {ev.payload?.provider && <span style={{ color: '#f80' }}> [Provider: {ev.payload.provider}]</span>}
              {ev.payload?.url && <span style={{ color: '#a8f' }}> [URL: {ev.payload.url}]</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
