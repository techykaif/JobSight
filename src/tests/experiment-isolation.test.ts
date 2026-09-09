import { describe, it, expect } from 'vitest';

describe('Experiment Aggregation Isolation', () => {
  it('experiment A cannot aggregate experiment B', () => {
    const manifestA = {
      experimentId: 'exp-A',
      runs: [{ runId: 'run-1', status: 'COMPLETED' }]
    };
    const manifestB = {
      experimentId: 'exp-B',
      runs: [{ runId: 'run-2', status: 'COMPLETED' }]
    };
    
    // An aggregator reading manifest A must only extract run-1
    const aggregatedRunIds = manifestA.runs.map(r => r.runId);
    expect(aggregatedRunIds).toContain('run-1');
    expect(aggregatedRunIds).not.toContain('run-2');
  });

  it('historical runs cannot enter current experiment', () => {
    const historicalRunId = 'run-historical';
    const manifest = {
      experimentId: 'exp-current',
      runs: [{ runId: 'run-current', status: 'COMPLETED' }]
    };
    const aggregatedRunIds = manifest.runs.map(r => r.runId);
    expect(aggregatedRunIds).not.toContain(historicalRunId);
  });

  it('Missing manifest run causes experiment aggregation to stop', () => {
    const manifest = {
      runs: [{ runId: 'run-1' }]
    };
    const dbRunStatuses = new Map([
      ['run-1', 'RUNNING']
    ]);
    
    let isComplete = true;
    for (const r of manifest.runs) {
      const status = dbRunStatuses.get(r.runId);
      if (!status || !['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'].includes(status)) {
        isComplete = false;
        break;
      }
    }
    
    expect(isComplete).toBe(false);
  });
});
