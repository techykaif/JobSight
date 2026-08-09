
# V1.3.1 — D1.4 Decision Board Intelligence Enhancement

## Starting state

A previous session had already added optional props (`readiness`, `companyOpportunity`, `confidence`) plus their variant-mapping helpers to `src/components/ui/JobCard.tsx` and wired them into the badge row and footer, but had not touched `src/app/board/page.tsx` at all — the Board still queried and rendered exactly as before D1.4 started. This session picked up from there per the brief's "inspect first, continue existing work" instruction; `JobCard.tsx`'s existing D1.4 additions were preserved untouched except for one targeted fix (below).

## What was preserved

- The five existing columns (Apply Now / Apply This Week / Monitor / Research / Rejected), their keys, icons, colors, and bucketing logic — unchanged.
- The existing job-count pill in each column header — unchanged (no decorative metrics added, since the brief said only to add header metrics if they fit cleanly without cluttering, and the existing header has no room for more without redesigning it).
- The existing `JobCard` "View Details" action — the only action that already had real functionality; no Apply/Queue/Monitor/Save buttons were invented.
- The existing ordering (`orderBy(desc(jobs.firstSeenAt))`) — not changed. There's no existing ranking field establishing an alternate intended order, so per the brief's explicit instruction not to silently change ordering semantics, it was left as-is.
- The existing ATS/nested-anchor pattern (`<div onClick={stop}><Link>...</Link></div>` for every badge, inside a `<Card>` that itself renders as a `<div role="button">`, never an `<a>`) — every new badge follows this exact existing pattern.
- The existing responsive/scrolling architecture (horizontal Kanban scroll, `overflow-x: auto`) — untouched.
- The existing empty-state markup per column — untouched.

## What was enhanced

**`src/components/ui/JobCard.tsx`** (1 targeted fix, not a rewrite):

- `competitionVariant()` previously only matched the old, uppercase `discoveryIntelligence.competition` vocabulary (`LOW`/`MEDIUM`/`HIGH`) exactly. Since the Board now also passes B2's Title Case vocabulary (`Very Low`/`Low`/`Medium`/`High`/`Very High`) through the same `competition` prop, the match was widened to be case-insensitive and to recognize the "Very Low"/"Very High" tiers, so both vocabularies badge correctly. Everything else in the file (the props, the readiness/company-opportunity variant helpers, the badge JSX, the confidence footer) was already in place from the prior session and was left untouched.

**`src/app/board/page.tsx`**:

- Added `companyId` to the existing job select (needed to look up B3 company opportunity, which is keyed by company, not job).
- Added four small batched lookups — B2 `competitionResults`, B5 `applicationResults`, `decisionResults` (confidence), and B3 `companyOpportunity` — each queried once per board load (chunked by 100 ids), not per card. These are deliberately *not* joined into the main query: each of those tables can carry one row per hunt run, and a plain `leftJoin` would risk the existing `uniqueJobsMap` dedup picking an arbitrary (not necessarily latest) run's row. A `latestByKey` reducer keeps the most recent row per job/company instead, so the Board always shows current, not stale, intelligence — this stays O(1) additional queries regardless of job count, so it doesn't introduce N+1.
- Passed the results into the existing `JobCard`: `readiness`, `companyOpportunity`, and `confidence` directly; `competition` now prefers the B2 result and falls back to the pre-existing `discoveryIntelligence.competition` field when B2 data doesn't exist yet for that job (verified — see below).

## Verification
