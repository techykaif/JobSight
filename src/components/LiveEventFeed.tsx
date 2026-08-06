'use client'

import { useState, useEffect } from 'react';

export default function LiveEventFeed({ runId }: { runId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

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
      setEvents(prev => {
        if (prev.find(x => x.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Simple reconnect logic
      setTimeout(() => {
        // In a real app we'd dispatch an action to reconnect cleanly
      }, 5000);
    };

    return () => {
      es.close();
    };
  }, [runId]);

  return (
    <div style={{ marginTop: '2rem' }}>
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
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
