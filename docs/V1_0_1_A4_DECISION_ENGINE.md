# JobSight V1.0.1-A4: Decision Intelligence Engine

## Architecture
JobSight has completed its transformation from a job discovery tool into a fully autonomous **Decision Intelligence Engine**.
The goal of this phase is to answer the user's most critical question: *"What should I do next?"*

The architecture introduces a third plugin system, the `DecisionRegistry`, which operates above the `DiscoveryProviderRegistry` and `DiscoveryAnalyzerRegistry`. The Decision Engine purely consumes downstream deterministic intelligence (Opportunity, Discovery, Qualification) and translates it into actionable strategy. It never recalculates prior metrics.

## Decision Registry
Strategies are evaluated in descending priority order. The first strategy that returns `true` for its `supports()` method dictates the decision.
Current Core Strategies:
1. `IgnoreStrategy` (Priority: 100) - Aggressively filters low authenticity or explicitly ignored jobs.
2. `ApplyNowStrategy` (Priority: 90) - Triggers on Urgent priorities or High Opportunity scores with immediate freshness.
3. `ApplyThisWeekStrategy` (Priority: 80) - Captures high quality, non-urgent roles.
4. `MonitorStrategy` (Priority: 70) - Flags roles that are older but still viable.
5. `FallbackStrategy` (Priority: 1) - Recommends further research if signals are insufficient.

## Decision Flow
1. The Pipeline invokes `runDecisionEngine(context)`.
2. The Engine iterates through the `DecisionRegistry`.
3. The chosen Strategy calculates the `DecisionResult` which includes:
   - Specific user actions (e.g., "Prepare cover letter").
   - Explicit `reasons` derived only from observable signals.
   - Computations for Application ROI and Urgency.
4. Telemetry (`DECISION_COMPLETED`, `DECISION_FAILED`) is emitted.

## Application ROI & Urgency
- **ROI**: Deterministically estimates the effort required to apply. E.g., `LOW` ROI if a take-home assignment is mentioned; `HIGH` ROI if "Easy Apply" is detected.
- **Urgency**: Deterministically estimates timeline. E.g., `TODAY` if it was posted today or marked as Urgent; `SOON` if text explicitly mentions "closing soon".

## Decision Queue
The `generateDecisionQueue` utility processes a batch of decisions and ranks them descending by Priority, establishing a strictly ordered queue for the user to execute.

## Application Strategy
The `generateWeeklyStrategy` utility rolls up the Decision Queue into a digestible sprint summary:
- Highest Priority Companies
- Jobs to Apply Today vs This Week
- Highest Salary Opportunities
- Remote Opportunities

## Dashboard (UI Prep)
With these models established, the frontend can easily generate a "Decision Dashboard" featuring pre-sorted kanban columns (Apply Today, Apply This Week, Monitor, Ignore) adorned with deterministic explanation badges, keeping the user entirely shielded from raw AI noise.

## Tests
Extensive deterministic tests (`src/tests/decision.test.ts`) assert that:
- Application ROI identifies specific trigger words correctly.
- Urgency properly degrades over time.
- The Engine selects the mathematically correct strategy.
- Queues sort perfectly by priority.
- Weekly strategies extract the correct subset of insights.

## Performance
By utilizing strict TypeScript logic and avoiding LLM reasoning loops, the Decision Engine determines strategy in sub-millisecond execution time per job.

## Future Extensions
- **Mission Manager Integration**: The Weekly Strategy could automatically spawn sub-agents to draft tailored cover letters for `APPLY_NOW` targets.
- **Dynamic Strategies**: Users could write their own TypeScript strategies (e.g., `ApplyOnlyIfSalaryOver200kStrategy`) and register them into the engine dynamically.
