import crypto from 'crypto';
import * as repos from '../db/repositories/index.js';
import { decisionRegistry } from './registry.js';
import { 
  IgnoreStrategy, 
  ApplyNowStrategy, 
  ApplyThisWeekStrategy, 
  MonitorStrategy, 
  FallbackStrategy 
} from './strategies.js';
import type { DecisionContext, DecisionResult, QueuedDecision, WeeklyStrategy } from './interfaces.js';

// Initialize core strategies
export function registerCoreStrategies() {
  decisionRegistry.register(new IgnoreStrategy());
  decisionRegistry.register(new ApplyNowStrategy());
  decisionRegistry.register(new ApplyThisWeekStrategy());
  decisionRegistry.register(new MonitorStrategy());
  decisionRegistry.register(new FallbackStrategy());
}

// Removed auto-registration to support centralized bootstrap
export async function runDecisionEngine(context: DecisionContext): Promise<DecisionResult> {
  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId: context.runId,
    timestamp: new Date().toISOString(),
    eventType: 'DECISION_STARTED',
    stage: 'DECISION',
    entityType: 'JOB',
    entityId: context.job.sourceUrl,
    payload: { opportunityScore: context.opportunity.opportunityScore }
  });

  const strategies = decisionRegistry.getAll(); // Sorted by priority

  for (const strategy of strategies) {
    try {
      const result = strategy.evaluate(context);
      if (result) {
        await repos.saveEvent({
          id: crypto.randomUUID(),
          runId: context.runId,
          timestamp: new Date().toISOString(),
          eventType: 'DECISION_COMPLETED',
          stage: 'DECISION',
          entityType: 'JOB',
          entityId: context.job.sourceUrl,
          payload: { 
            strategy: strategy.name, 
            decision: result.decision,
            priority: result.priority
          }
        });

        // Insert into decision_results via repo would happen here
        
        return result;
      }
    } catch (e: any) {
      console.error(`[DecisionEngine] Strategy ${strategy.name} failed:`, e);
      await repos.saveEvent({
        id: crypto.randomUUID(),
        runId: context.runId,
        timestamp: new Date().toISOString(),
        eventType: 'DECISION_FAILED',
        stage: 'DECISION',
        entityType: 'JOB',
        entityId: context.job.sourceUrl,
        payload: { strategy: strategy.name, error: e.message }
      });
    }
  }

  throw new Error('No decision strategy returned a result (FallbackStrategy missing?)');
}

export async function generateDecisionQueue(runId: string, decisions: Array<{ context: DecisionContext, result: DecisionResult }>): Promise<QueuedDecision[]> {
  const sorted = [...decisions].sort((a, b) => b.result.priority - a.result.priority);
  
  const queue = sorted.map((d, index) => ({
    jobId: d.context.job.sourceUrl || `job_${index}`,
    rank: index + 1,
    result: d.result,
    context: d.context
  }));

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'QUEUE_GENERATED',
    stage: 'DECISION',
    payload: { queueSize: queue.length }
  });

  return queue;
}

export async function generateWeeklyStrategy(runId: string, queue: QueuedDecision[]): Promise<WeeklyStrategy> {
  const jobsToApplyToday = queue.filter(q => q.result.decision === 'APPLY_NOW');
  const jobsToApplyThisWeek = queue.filter(q => q.result.decision === 'APPLY_THIS_WEEK');
  const jobsToMonitor = queue.filter(q => q.result.decision === 'MONITOR');
  const jobsToIgnore = queue.filter(q => q.result.decision === 'IGNORE');
  const jobsToResearch = queue.filter(q => q.result.decision === 'RESEARCH_MORE');

  const highestPriorityCompanies = [...new Set(
    jobsToApplyToday.concat(jobsToApplyThisWeek)
      .filter(q => q.context.job.companyName)
      .map(q => q.context.job.companyName!)
  )];

  const highestSalaryOpportunities = [...queue].sort((a, b) => {
    const aSal = typeof a.context.job.salaryMax === 'number' ? a.context.job.salaryMax : 0;
    const bSal = typeof b.context.job.salaryMax === 'number' ? b.context.job.salaryMax : 0;
    return bSal - aSal;
  }).slice(0, 5).filter(q => typeof q.context.job.salaryMax === 'number');

  const remoteOpportunities = queue.filter(q => q.context.job.remoteType === 'REMOTE');

  const strategy: WeeklyStrategy = {
    highestPriorityCompanies,
    jobsToApplyToday,
    jobsToMonitor,
    jobsToIgnore,
    jobsToResearch,
    companiesExpanding: [], // Would require historical company data integration
    highestSalaryOpportunities,
    remoteOpportunities
  };

  await repos.saveEvent({
    id: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    eventType: 'STRATEGY_COMPLETED',
    stage: 'DECISION',
    payload: { 
      todayCount: jobsToApplyToday.length,
      ignoreCount: jobsToIgnore.length
    }
  });

  return strategy;
}
