import type { DecisionStrategy, DecisionContext, DecisionResult } from './interfaces.js';
import { estimateApplicationRoi, estimateUrgency } from './estimators.js';

export class IgnoreStrategy implements DecisionStrategy {
  id = 'strategy_ignore';
  name = 'Ignore Strategy';
  version = '1.0.0';

  priority(): number { return 100; } // Very high priority if it hits ignore criteria

  supports(context: DecisionContext): boolean {
    return context.opportunity.priority === 'IGNORE' || context.discovery.authenticity === 'VERY_LOW';
  }

  evaluate(context: DecisionContext): DecisionResult | null {
    if (!this.supports(context)) return null;

    return {
      decision: 'IGNORE',
      priority: 0,
      confidence: 90,
      reasons: ['Opportunity priority is IGNORE or Authenticity is VERY_LOW'],
      unknowns: [],
      requiredActions: [],
      roiLevel: 'VERY_LOW',
      urgencyLevel: 'UNKNOWN'
    };
  }
}

export class ApplyNowStrategy implements DecisionStrategy {
  id = 'strategy_apply_now';
  name = 'Apply Now Strategy';
  version = '1.0.0';

  priority(): number { return 90; }

  supports(context: DecisionContext): boolean {
    return context.opportunity.priority === 'URGENT' || 
           (context.opportunity.opportunityScore >= 80 && estimateUrgency(context) === 'TODAY');
  }

  evaluate(context: DecisionContext): DecisionResult | null {
    if (!this.supports(context)) return null;

    const roi = estimateApplicationRoi(context);
    const actions = ['Prepare resume'];
    
    if (roi === 'LOW') actions.push('Prepare for intensive application process (e.g. cover letter or assessment)');
    else actions.push('Apply now');

    const reasons = [
      'High opportunity score',
      context.discovery.freshness === 'TODAY' ? 'Fresh posting' : 'Urgent priority',
      `Authenticity: ${context.discovery.authenticity}`
    ];

    return {
      decision: 'APPLY_NOW',
      priority: 100,
      confidence: 85,
      reasons,
      unknowns: [],
      requiredActions: actions,
      roiLevel: roi,
      urgencyLevel: 'TODAY'
    };
  }
}

export class ApplyThisWeekStrategy implements DecisionStrategy {
  id = 'strategy_apply_this_week';
  name = 'Apply This Week Strategy';
  version = '1.0.0';

  priority(): number { return 80; }

  supports(context: DecisionContext): boolean {
    return context.opportunity.priority === 'HIGH' || context.opportunity.opportunityScore >= 60;
  }

  evaluate(context: DecisionContext): DecisionResult | null {
    if (!this.supports(context)) return null;

    return {
      decision: 'APPLY_THIS_WEEK',
      priority: 80,
      confidence: 80,
      reasons: ['Strong opportunity score', 'Acceptable authenticity'],
      unknowns: [],
      requiredActions: ['Schedule time to apply this week'],
      roiLevel: estimateApplicationRoi(context),
      urgencyLevel: 'THIS_WEEK'
    };
  }
}

export class MonitorStrategy implements DecisionStrategy {
  id = 'strategy_monitor';
  name = 'Monitor Strategy';
  version = '1.0.0';

  priority(): number { return 70; }

  supports(context: DecisionContext): boolean {
    return context.opportunity.priority === 'NORMAL' && context.discovery.freshness === 'OLDER';
  }

  evaluate(context: DecisionContext): DecisionResult | null {
    if (!this.supports(context)) return null;

    return {
      decision: 'MONITOR',
      priority: 50,
      confidence: 70,
      reasons: ['Opportunity is older', 'Moderate score'],
      unknowns: [],
      requiredActions: ['Monitor for reposting or changes'],
      roiLevel: estimateApplicationRoi(context),
      urgencyLevel: 'LATER'
    };
  }
}

export class FallbackStrategy implements DecisionStrategy {
  id = 'strategy_fallback';
  name = 'Fallback Research Strategy';
  version = '1.0.0';

  priority(): number { return 1; }

  supports(context: DecisionContext): boolean {
    return true; // Catch-all
  }

  evaluate(context: DecisionContext): DecisionResult | null {
    return {
      decision: 'RESEARCH_MORE',
      priority: 20,
      confidence: 50,
      reasons: ['Did not meet criteria for immediate application or explicit ignore'],
      unknowns: ['Insufficient signals for clear decision'],
      requiredActions: ['Research company', 'Research role requirements'],
      roiLevel: estimateApplicationRoi(context),
      urgencyLevel: 'UNKNOWN'
    };
  }
}
