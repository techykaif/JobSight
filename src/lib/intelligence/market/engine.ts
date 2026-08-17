import {
  VisibilityAnalyzer,
  CompetitionAnalyzer,
  HiringFrictionAnalyzer,
  OpportunityIntelligenceEvaluator
} from './analyzers.js';
import type { MarketIntelligenceContext, MarketIntelligenceResult } from './interfaces.js';

export function runMarketIntelligence(context: MarketIntelligenceContext): MarketIntelligenceResult {
  const visAnalyzer = new VisibilityAnalyzer();
  const compAnalyzer = new CompetitionAnalyzer();
  const fricAnalyzer = new HiringFrictionAnalyzer();
  const oppEvaluator = new OpportunityIntelligenceEvaluator();

  const visibility = visAnalyzer.analyze(context);
  const competition = compAnalyzer.analyze(context);
  const friction = fricAnalyzer.analyze(context);

  const opportunityIntelligence = oppEvaluator.evaluate(visibility, competition, friction);

  return {
    visibility,
    competition,
    friction,
    opportunityIntelligence
  };
}
