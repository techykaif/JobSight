# V1.3.1-D1.3 — Company Profile Intelligence Enhancement

**Sprint:** D1.3 — Company Profile Intelligence Surface  
**Scope:** `src/app/companies/[id]/page.tsx` only — no backend changes, no new component files  
**Date:** 2026-08-08

---

## What Was Enhanced

### 1. Company Header — Enriched Badges

The existing header preserved exactly. Two new StatusBadge items added conditionally:

| Badge | Source | Condition |
|---|---|---|
| Opportunity Level | `companyOpportunity.level` | When B3 data exists |
| Hiring Trend | `companySummary.hiringTrend` / fallbacks | When any trend data exists |

The "Highly Authentic" badge (avgAuthenticity > 80) is preserved unchanged.
Now uses `StatusBadge` component rather than an ad-hoc inline `<span>` for
consistency with the Phase C design system.

### 2. Overview MetricCards — Enriched Sources

Six MetricCards preserved. Three now use B3-preferred values with fallback chains:

| Card | Primary (B3) | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Hiring Trend | `companySummary.hiringTrend` | `companyOutlook.trend` | `companyAnalysis.hiringMomentum` |
| Remote Hiring | `companySummary.remoteHiring` | `companyAnalysis.remoteFriendliness` | Research artifact |
| Eng. Hiring | `companySummary.engineeringHiring` | `companyAnalysis.engineeringHiringActivity` | "Unknown" |

A new "Opportunity Score" MetricCard is conditionally appended when `companyOpportunity` data exists.
The "Hidden Gems" MetricCard is now conditional (hidden when count = 0).

### 3. B3 Intelligence Summary Strip — New

Compact horizontal strip below the overview grid, only rendered when any B3
data exists (`companyOpportunity`, `companySummary`, `companyOutlook`):

| Pill | Source | Field |
|---|---|---|
| Opportunity | `companyOpportunity` | level |
| Hiring Trend | `companySummary` | hiringTrend |
| Stability | `companyOutlook` | stability |
| Competition | `companySummary` | competition |
| Authenticity | `companySummary` | authenticity |
| Confidence | `companySummary` | confidence |
| Momentum | `companyOutlook` | momentum/100 |

Entirely conditional — does not render when no B3 data exists.

### 4. Posting History Table — Enriched Columns

Two new columns added to the existing table:

**Decision column** — per-job `decisionResults.decision` (falls back to `decisions.decision`):
- StatusBadge with appropriate variant (success=APPLY, warning=CONSIDER, danger=SKIP)
- Links to `/jobs/[id]` for full detail
- Shows `—` when no decision exists

**Readiness column** — per-job `applicationResults.readinessLevel`:
- StatusBadge with readiness variant
- Links to `/jobs/[id]` for full detail
- Shows `—` when not yet analyzed

**Job Sort Order:** Jobs are now sorted by decision priority before date:
- APPLY / APPLY_NOW first
- CONSIDER / APPLY_LATER second
- RESEARCH_REQUIRED third
- MONITOR fourth
- SKIP / REJECTED last
- Within same priority: newest first

This is done without creating any new ranking algorithm — uses existing `decisions`
and `decisionResults` data only.

All batch fetching uses `inArray` chunks of 50 (matching existing pattern) with
`Promise.all` within each chunk to minimize round trips.

### 5. Company Opportunity Card — New Sidebar Section

New sidebar card showing full B3 data when available:

**Data sources:**
- `companyOpportunity` — level badge, score with progress bar, confidence
- `companySummary` — hiringTrend, remoteHiring, engineeringHiring, competition, evidenceCount
- `companyOutlook` — momentum, stability

Shows "Company opportunity analysis not available yet." when no B3 data.

### 6. Intelligence Snapshots — Enhanced

Existing "Intelligence Snapshots" sidebar card preserved and enriched:

- Growth Signal, Layoff Signal, Engineering Activity rows preserved (from `companyAnalysis`)
- `companySignals` table records now shown as a "Key Signals" subsection (up to 5 signals)
- Signal types are humanized (underscores → spaces, title-cased)
- Research timestamp preserved

### 7. Competition Overview — New Sidebar Section

Conditionally rendered when competition data is available:

**Primary:** Uses `companySummary.competition` text (from B3).

**Fallback:** When B3 is absent, aggregates `competitionResults` from the
company's jobs:
- Computes `avgCompetitionScore` (mean of per-job scores)
- Computes `dominantCompetitionLevel` (most frequent level string)
- Shows progress bar and job count
- Clearly notes "Aggregated from N job-level results."

**Not shown:** When neither B3 nor per-job competition data exists.

No new competition logic was created — uses only existing stored values.

### 8. Observed Sources — Enhanced with Discovery Quality

The existing "Observed Sources" list is preserved.

A new "Discovery Quality" subsection is conditionally appended within the same
card when any of the following are available:

- `avgDiscoveryScore` — mean of `oppDiscoveryResults.score` across company's jobs
- `avgAuthenticity` — existing computed value (unchanged)
- `hiddenGemCount` — existing computed value (unchanged)

This answers "Are these opportunities coming from trustworthy sources?" using
only existing stored data.

---

## Existing Content Preserved

- Company header (name, website, careers links, back button)
- Breadcrumbs
- All 6 original MetricCard concepts (Hiring Trend, Open Roles, Remote, Funding, Size, Hidden Gems)
- Posting History table (Role, Location, Status, First Seen columns unchanged)
- Observed Sources list
- Intelligence Snapshots panel (growth signal, layoff signal, engineering hiring, timestamp)
- `IntelRow` helper component (updated to use design tokens, preserved semantics)

---

## Existing Components Reused

| Component | Usage |
|---|---|
| `MetricCard` | All overview cards |
| `StatusBadge` | Decision, readiness, opportunity, trend, stability badges |
| `EmptyState` | Company Not Found state |
| `ActionButton` | Empty state CTA |
| `Breadcrumbs` | Navigation trail |
| `ProgressBar` | Opportunity score, competition, discovery score bars |
| `Link` | All internal navigation (jobs, filters) |

No new component files were created. `IntelRow` and `IntelPill` are
local-only functions within this file (same pattern as existing `IntelRow`).

---

## Intelligence Surfaced

| Phase | Engine | Tables | Sections |
|---|---|---|---|
| B3 | Company Opportunity | `companyOpportunity`, `companySummary`, `companyOutlook`, `companySignals` | Company Opportunity card, Summary strip, MetricCards |
| B5 | Application Intelligence | `applicationResults` | Readiness column in Posting History |
| A4 | Decision Engine | `decisions`, `decisionResults` | Decision column + sort in Posting History |
| B2 | Competition | `competitionResults` | Competition Overview (fallback) |
| B4 | Discovery | `oppDiscoveryResults` | Discovery Quality subsection |
| Core | Discovery | `discoveryIntelligence` | avgAuthenticity, hiddenGemCount (preserved) |
| Core | Sources | `jobSources` | Observed Sources (preserved) |
| Core | Analysis | `companyAnalysis` | Intelligence Snapshots (fallback) |
| Core | Research | `researchArtifacts` | Funding, Company Size (preserved) |

---

## Files Changed

| File | Change Type |
|---|---|
| `src/app/companies/[id]/page.tsx` | Enhanced (only source file modified) |
| `docs/V1_3_1_D1_3_COMPANY_PROFILE_ENHANCEMENT.md` | Created (this file) |

---

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS — Zero errors |
| `npm test` | PASS — 139/139 tests, 31 test files |
| `npm run build` | PASS — `/companies/[id]` correctly dynamic (ƒ) |
| No fake data | PASS — All "Unknown" strings are explicit fallbacks, no fabricated scores |
| No nested `<a>`/`<Link>` | PASS — External links use `<a>`, internal use `<Link>` (no nesting) |
| No new component files | PASS — Local sub-components only |
| No backend changes | PASS — SELECT-only queries on existing tables |
| All existing sections intact | PASS — Every original card/section preserved |
| Graceful degradation | PASS — Each intelligence section conditional |
| Responsive layout | PASS — Grid collapses to 1 column at ≤900px |
| generateMetadata | PASS — Page title uses real company name |
| N+1 queries prevented | PASS — All job-level data batched with inArray + Promise.all |

---

## Limitations

1. **No company-level competition table** — There is no `competition_results` or
   `competition_summary` table keyed by `companyId`. Competition is only available
   at the job level. The Competition Overview uses `companySummary.competition`
   (a string label from B3) as primary, or aggregates per-job `competitionResults`
   as fallback. No company-level score is fabricated.

2. **No `oppDiscoverySummary` at company level** — The `opp_discovery_summary`
   table is job-scoped. Discovery Quality shows the mean of per-job
   `oppDiscoveryResults.score` values rather than a dedicated company-level
   discovery score.

3. **`companySignals` displayed raw** — Signal types from `companySignals` are
   stored as uppercase underscore strings (e.g. `HIRING_VELOCITY`). They are
   humanized for display but are not semantically enriched. If the B3 engine
   stores structured signal values, they will show as-is.

4. **Posting History table may be wide on mobile** — The table now has 6 columns.
   At ≤900px, the full layout shifts to single-column but the table itself may
   require horizontal scroll on very narrow screens. This is consistent with
   the `overflowX: auto` wrapping present in the original code and kept intact.

5. **No D1.4+ work started** — This sprint stops at Company Profile only.
   Decision Board, Discovery Radar, and Pipeline Health are not touched.
