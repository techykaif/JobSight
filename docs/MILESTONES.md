# JobSight AI Job Intelligence System: Implementation Milestones

## CORE PRINCIPLE
Each milestone must be independently verifiable. Milestone 1 must be the SMALLEST possible working vertical — not 'build the whole thing'.

## TECHNOLOGY STACK
- Next.js 15 (App Router) — full-stack TypeScript
- SQLite (better-sqlite3) + Drizzle ORM
- Zod for validation
- execa for process management
- chalk + ora for terminal output
- Vanilla CSS for styling
- agy CLI for AI worker tasks
- SSE for real-time events
- Vitest for testing

## MILESTONES

### Milestone 0: Project Scaffolding
**Goal**: Empty Next.js project with tooling configured
**Tasks**:
- Initialize Next.js 15 with App Router + TypeScript
- Configure ESLint, Prettier
- Set up project directory structure
- Create README.md
- Set up .gitignore
- Create .agents/ directory with initial AGENTS.md
- Verify `npm run dev` works

**Verification**: `npm run dev` starts, shows default page
**Duration estimate**: 30 minutes

### Milestone 1: AGY Integration Proof of Concept
**Goal**: Prove we can invoke AGY from Node.js and get structured output
**Tasks**:
- Create `lib/agy/client.ts` — wrapper around `agy -p` using execa
- Create `lib/agy/schemas.ts` — Zod schemas for AGY responses
- Create a test script that:
  1. Invokes `agy -p` with a simple prompt
  2. Uses `--json-schema` for structured output
  3. Uses `--output-format json` for JSON response
  4. Parses the response
  5. Validates with Zod
- Create `lib/agy/worker.ts` — single worker abstraction
- Handle timeout, error, success cases
- Terminal output showing invocation + result

**Verification**: Run test script, see structured JSON output in terminal
**Duration estimate**: 2-3 hours
**Dependencies**: Milestone 0

### Milestone 2: Database & Data Model Foundation
**Goal**: SQLite database with Drizzle schema, migrations, and basic CRUD
**Tasks**:
- Install better-sqlite3 + drizzle-orm + drizzle-kit
- Create `lib/db/schema.ts` with core tables (runs, jobs, companies, tasks, events)
- Create migration system
- Create `lib/db/client.ts` — database connection
- Create basic repository functions (insert/query for each table)
- Write tests for CRUD operations

**Verification**: Run tests, verify tables created and data persists
**Duration estimate**: 3-4 hours
**Dependencies**: Milestone 0

### Milestone 3: Event System
**Goal**: Working event emission, JSONL logging, and terminal display
**Tasks**:
- Create `lib/events/emitter.ts` — typed event emitter
- Create `lib/events/logger.ts` — JSONL file writer
- Create `lib/events/terminal.ts` — colorized terminal output
- Define all event types with TypeScript
- Create event persistence to SQLite events table
- Write tests for event flow

**Verification**: Emit events, see them in terminal + JSONL file + database
**Duration estimate**: 2-3 hours
**Dependencies**: Milestone 2

### Milestone 4: Job Discovery Pipeline (End-to-End Vertical Slice)
**Goal**: Full discovery flow — from config → AGY search → structured results → database
**Tasks**:
- Create `lib/mission/config.ts` — hunt config validation (Zod)
- Create `lib/pipeline/discover.ts` — discovery stage
- Create AGY task: DISCOVER_JOBS with prompt template + schema
- Create `.agents/tasks/discover.md` instruction file
- Wire: config → prompt → AGY invocation → parse → validate → store
- URL normalization and deduplication
- Terminal output showing discovered jobs

**Verification**: Run with a test config, see jobs discovered and stored in SQLite
**Duration estimate**: 4-5 hours
**Dependencies**: Milestones 1, 2, 3

### Milestone 5: Job Fetching & Extraction
**Goal**: Fetch job listing pages and extract structured data
**Tasks**:
- Create FETCH_LISTING task (read_url_content via AGY)
- Create EXTRACT_JOB task (LLM extraction via AGY)
- Content quality assessment
- Create `.agents/tasks/fetch.md` and `.agents/tasks/extract.md`
- Auth detection (login page patterns)
- Store extracted job data

**Verification**: Fetch real job URLs, see extracted structured data
**Duration estimate**: 4-5 hours
**Dependencies**: Milestone 4

### Milestone 6: Initial Filtering
**Goal**: Apply deterministic filters to discovered/extracted jobs
**Tasks**:
- Create `lib/pipeline/filter.ts`
- Location filter
- Remote type filter
- Employment type filter
- Exclusion filter (roles, companies, keywords)
- Salary range filter
- Emit JOB_REJECTED with reasons

**Verification**: Filter a set of test jobs, verify correct rejections
**Duration estimate**: 2-3 hours
**Dependencies**: Milestone 5

### Milestone 7: Profile Management
**Goal**: User can create/edit profile, resume, and skills
**Tasks**:
- Create profile file structure (data/profile/)
- Create `lib/profile/loader.ts`
- Create profile API routes
- Create basic profile editor UI page
- Validate profile schema with Zod

**Verification**: Create profile via UI, verify persisted files
**Duration estimate**: 3-4 hours
**Dependencies**: Milestone 0

### Milestone 8: Requirement Analysis & Profile Matching
**Goal**: Analyze requirement strictness and match against profile
**Tasks**:
- Create ANALYZE_REQUIREMENTS AGY task
- Create MATCH_PROFILE AGY task
- Create `.agents/tasks/analyze.md` and `.agents/tasks/match.md`
- Wire to pipeline
- Store results in requirement_analyses and profile_matches tables

**Verification**: Run against extracted jobs, see analysis and match scores
**Duration estimate**: 4-5 hours
**Dependencies**: Milestones 5, 7

### Milestone 9: Company Research & Hiring Intelligence
**Goal**: Research companies and gather hiring signals
**Tasks**:
- Create RESEARCH_COMPANY AGY task
- Create RESEARCH_HIRING AGY task
- Company deduplication
- Evidence URL tracking
- Create `.agents/tasks/company-research.md` and `.agents/tasks/hiring-research.md`

**Verification**: Research real companies, see structured results with source URLs
**Duration estimate**: 4-5 hours
**Dependencies**: Milestone 8

### Milestone 10: Scoring Engine
**Goal**: Deterministic scoring of all qualified jobs
**Tasks**:
- Create `lib/scoring/engine.ts`
- Implement 7 score dimensions
- Configurable weights
- Composite score calculation
- Ranking
- Store in scores table

**Verification**: Score a set of jobs, verify score breakdown
**Duration estimate**: 3-4 hours
**Dependencies**: Milestone 9

### Milestone 11: Mission Engine & Full Pipeline Orchestration
**Goal**: Complete orchestrated pipeline from config → final report
**Tasks**:
- Create `lib/mission/engine.ts` — stage orchestration
- State machine implementation
- Checkpoint/resume support
- Worker pool with configurable concurrency
- Per-domain rate limiting
- Run lifecycle management
- Error handling and retry logic

**Verification**: Run complete pipeline end-to-end with real job search
**Duration estimate**: 6-8 hours
**Dependencies**: Milestones 4-10

### Milestone 12: Dashboard UI — Core
**Goal**: Web dashboard showing runs and job results
**Tasks**:
- Hunt configuration form (all configurable parameters)
- Run list page
- Run detail page with job cards
- Job detail view with scores
- Company information cards
- Responsive design, dark mode

**Verification**: Start a hunt from UI, see results in dashboard
**Duration estimate**: 8-10 hours
**Dependencies**: Milestone 11

### Milestone 13: Real-Time Events & Live Dashboard
**Goal**: SSE event streaming from server to dashboard
**Tasks**:
- Create SSE endpoint
- Event bridge: emitter → SSE
- Live event timeline in UI
- Auto-refreshing job list
- Run progress indicators
- Terminal-like log viewer in UI

**Verification**: Start a run, see live events in dashboard
**Duration estimate**: 4-5 hours
**Dependencies**: Milestone 12

### Milestone 14: Historical Intelligence
**Goal**: Cross-run analysis and pattern detection
**Tasks**:
- Job observation tracking across runs
- Repost detection
- Salary change detection
- Company hiring frequency analysis
- Historical trends in dashboard

**Verification**: Run multiple hunts, see historical patterns
**Duration estimate**: 5-6 hours
**Dependencies**: Milestone 13

### Milestone 15: Polish & Hardening
**Goal**: Production-quality local application
**Tasks**:
- Error boundary UI components
- Loading states everywhere
- Empty states
- Comprehensive error messages
- Performance optimization
- Full test coverage for critical paths
- Documentation

**Verification**: Thorough manual testing, all edge cases handled
**Duration estimate**: 6-8 hours
**Dependencies**: Milestone 14

## SUMMARY TABLE

| Milestone | Name | Status | Key Deliverable |
| :--- | :--- | :--- | :--- |
| M0 | Project Scaffolding | COMPLETED | Working `npm run dev` with Next.js default page |
| M1 | AGY Integration POC | COMPLETED | CLI structured JSON output from AGY |
| M2 | Capability Discovery | COMPLETED | Web search, retrieval capability probing |
| M3 | Canonical DB Schema | COMPLETED | SQLite DB with Drizzle ORM |
| M4 | Job Ingestion | COMPLETED | Job fetching, validation, structuring |
| M5 | Qualification Engine | COMPLETED | Filters and decision logic for profile match |
| M6 | Company Intelligence | COMPLETED | Evidence-backed company research signals |
| M7 | Product UI Foundation | COMPLETED | Next.js dashboard, config, run details |
| M8 | Mission Orchestrator | COMPLETED | End-to-end execution of discovery & processing |
| M9 | Reliability & Recovery | COMPLETED | Crash recovery, checkpointing, staleness detection |
| M10 | V1 Hardening & Release | COMPLETED | Final verification, constraints, security, frozen V1 |

## RISK REGISTER

- **M1 AGY Integration**: Risk that structured output is unreliable → mitigation: retry + prompt refinement
- **M4 Discovery**: Risk that search_web returns poor results → mitigation: multiple query strategies
- **M5 Fetching**: Risk that read_url_content fails on SPAs → mitigation: content quality flags + fallback to search snippets
- **M11 Orchestration**: Risk of complex state management → mitigation: simple sequential first, parallel later
- **General**: AGY process limits unknown → mitigation: conservative concurrency defaults
