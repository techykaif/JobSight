# JobSight + Antigravity (AGY) System Design

This document defines how the JobSight application interfaces with the Antigravity (AGY) CLI as its AI worker layer.

## KEY VERIFIED FACTS
- **AGY CLI Version:** v1.1.10
- **Invocation Pattern:** `agy -p "prompt" --output-format json --json-schema '{...}' --print-timeout 5m`
- **Response Format (JSON):** `{conversation_id, status, response, structured_output, duration_seconds, num_turns, usage}`
- **Capabilities:** Features `search_web` and `read_url_content` tools (NO browser automation).
- **Session Management:** Supports `--continue` and `--conversation <id>` for conversation resumption.
- **Permissions:** Supports `--dangerously-skip-permissions` for auto-approval in headless environments.
- **Context:** Supports `--add-dir` for mounting workspace directories.
- **Delegation:** Can spawn subagents internally for complex workflows.
- **Performance:** Typically ~7-20 seconds per invocation depending on complexity.

---

## 1. AGY Invocation Architecture

The core pattern relies on the Node.js Orchestrator spawning child processes to interact with the AGY CLI in headless mode, capturing structured JSON output.

```
Node.js Orchestrator
  → spawns child process: agy -p "<prompt>" --output-format json --json-schema '<schema>'
  → captures stdout JSON
  → parses structured_output
  → validates with Zod
  → stores result
```

### TypeScript Interfaces

```typescript
export interface AgyInvocation {
  taskType: string;
  prompt: string;
  jsonSchema: object;
  timeout: number; // in milliseconds
  workingDirectory: string;
  conversationId?: string; // provided for session resumption
}

export interface AgyUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
}

export interface AgyResult<T = unknown> {
  conversationId: string;
  status: 'SUCCESS' | 'ERROR';
  response: string;
  structuredOutput?: T;
  durationSeconds: number;
  numTurns: number;
  usage: AgyUsage;
}
```

---

## 2. Task Type Definitions

The worker layer executes distinct task types. Each has a specific purpose, input, prompt template, schema, and validation rule.

### 2.1 DISCOVER_JOBS
- **Purpose:** Find new job listings matching user criteria.
- **Input Data:** `role`, `location`, `keywords`, `sources to search`.
- **AGY Tools:** `search_web`.
- **Instruction / Prompt:** Instructs AGY to execute multiple search queries and deduplicate listings.
- **Output Schema:** Array of `{url, title, company, source, snippet}`.
- **Validation & Retry:** Schema validation; retry 1x if schema is missing or invalid.

### 2.2 FETCH_LISTING
- **Purpose:** Retrieve the raw content of a specific job posting page.
- **Input Data:** `URL` of the job listing.
- **AGY Tools:** `read_url_content`.
- **Instruction / Prompt:** Fetch content and evaluate if the payload is complete or a JS-required SPA stub.
- **Output Schema:** `{raw_markdown: string, content_quality: 'FULL' | 'PARTIAL' | 'EMPTY' | 'AUTH_REQUIRED', page_title: string}`.
- **Validation & Retry:** Retry fetching using alternate sources or headless browser fallback if `content_quality` is not FULL. Note that many pages will return partial content (SPAs).

### 2.3 EXTRACT_JOB
- **Purpose:** Parse unstructured fetched content into a structured job record. Pure LLM reasoning.
- **Input Data:** Raw page content from `FETCH_LISTING`.
- **Instruction / Prompt:** Extract all fields based strictly on the text. Never fabricate. Use null for missing data.
- **Output Schema:** Detailed job object:
  ```json
  {
    "title": "string",
    "company": "string",
    "location": "string | null",
    "salary_min": "number | null",
    "salary_max": "number | null",
    "salary_currency": "string | null",
    "remote_type": "'remote' | 'hybrid' | 'onsite' | null",
    "experience_min": "number | null",
    "experience_max": "number | null",
    "required_skills": ["string"],
    "preferred_skills": ["string"],
    "responsibilities": ["string"],
    "benefits": ["string"],
    "employment_type": "string | null",
    "posted_date": "string | null",
    "application_url": "string | null",
    "extraction_confidence": "'high' | 'medium' | 'low'"
  }
  ```
- **Validation & Retry:** Ensure confidence is high/medium.

### 2.4 ANALYZE_REQUIREMENTS
- **Purpose:** Determine if stated job requirements are genuinely strict or just wish lists.
- **Input Data:** Extracted job data + original raw content.
- **Instruction / Prompt:** Evaluate requirement language to deduce flexibility.
- **Output Schema:**
  ```json
  {
    "requirements_analysis": [
      {
        "requirement_text": "string",
        "strictness": "hard | soft | aspirational",
        "reasoning": "string",
        "evidence_quote": "string"
      }
    ],
    "overall_flexibility_score": "number (0-100)"
  }
  ```
- **Validation & Retry:** Quotes must literally appear in the raw text.

### 2.5 MATCH_PROFILE
- **Purpose:** Evaluate the job against a user's profile/resume.
- **Input Data:** Extracted job + requirement analysis + user profile.
- **Instruction / Prompt:** Compare required skills and experience against profile data.
- **Output Schema:**
  ```json
  {
    "skill_matches": ["string"],
    "skill_gaps": ["string"],
    "experience_fit": "string",
    "education_fit": "string",
    "overall_match_score": "number (0-100)",
    "match_reasoning": "string"
  }
  ```

### 2.6 RESEARCH_COMPANY
- **Purpose:** Gather organizational intelligence on the hiring company.
- **Input Data:** `company_name`, optional `domain`.
- **AGY Tools:** `search_web`.
- **Output Schema:**
  ```json
  {
    "company_size": "string | null",
    "industry": "string | null",
    "founded_year": "number | null",
    "headquarters": "string | null",
    "tech_stack": ["string"],
    "glassdoor_rating": "number | null",
    "funding_info": "string | null",
    "remote_policy": "string | null",
    "notable_facts": ["string"],
    "source_urls": ["string"]
  }
  ```
- **Validation & Retry:** All nullable. Must have source URLs for claims.

### 2.7 RESEARCH_HIRING
- **Purpose:** Identify hiring momentum, recent layoffs, and overall company health.
- **Input Data:** `company_name`, `role_type`.
- **AGY Tools:** `search_web`.
- **Output Schema:**
  ```json
  {
    "recent_postings_count": "number | null",
    "hiring_momentum": "growing | stable | declining | unknown",
    "recent_layoffs": "boolean | null",
    "recent_funding": "boolean | null",
    "job_age_estimate": "string | null",
    "repost_signals": "boolean | null",
    "engineering_team_growth": "string | null",
    "source_urls": ["string"]
  }
  ```
- **Validation:** Distinguish clearly between OBSERVED facts (with URLs) and INFERRED assumptions.

---

## 3. Prompt Engineering Strategy

Prompts passed to AGY are composed dynamically:
1. **System Context:** Injected via workspace rules from the `.agents/` folder.
2. **Task-Specific Instruction:** What AGY needs to do right now.
3. **Input Data:** JSON-encoded data passed into the prompt.
4. **Output Schema Requirements:** Description of the expected JSON shape.
5. **Evidence Requirements:** Reminders to quote sources.
6. **Null Policy:** "Use null for any information you cannot verify. Never fabricate."

### Example Pattern:
```typescript
const prompt = `
[SYSTEM CONTEXT]
You are a precision data extraction agent. 
Adhere to the Never Fabricate policy. Use null if data is missing.

[TASK INSTRUCTION]
Analyze the provided job listing and extract the required fields.

[INPUT DATA]
${JSON.stringify(rawMarkdown)}

[OUTPUT SCHEMA]
Provide your answer matching this JSON schema: ${JSON.stringify(schema)}
`;
```

---

## 4. AGY Instruction File Hierarchy

To ensure maintainability and consistency, AGY's system prompts and behaviors are configured through a dedicated file hierarchy in the workspace:

```
.agents/
  AGENTS.md              # Top-level agent configuration and registry
  rules/
    system.md            # Global rules for all AGY invocations  
    evidence.md          # Evidence/source requirements
    null-policy.md       # Never fabricate policy
  tasks/
    discover.md          # Discovery task instructions
    fetch.md             # Fetch listing instructions
    extract.md           # Extraction instructions  
    analyze.md           # Requirement analysis instructions
    match.md             # Profile matching instructions
    company-research.md  # Company research instructions
    hiring-research.md   # Hiring intelligence instructions
```

At runtime, the Node.js orchestrator concatenates the relevant `rules/` and specific `tasks/` file to construct the final prompt.

---

## 5. Worker Pool Design

- **Concurrency:** Max concurrent AGY processes (configurable, default: 3).
- **Queueing:** Queue with priority levels (e.g., user-triggered fetches are high priority, background discovery is low priority).
- **Worker Lifecycle:** `IDLE → ASSIGNED → RUNNING → COMPLETED/FAILED`.
- **Timeouts:** Process timeout handled by `--print-timeout` at the AGY level and `execa` timeout at the Node level.
- **Telemetry:** Stdout/stderr captured and logged per run.
- **Resource Tracking:** Token usage tracked per task from the AGY JSON output.

---

## 6. Error Handling & Retry Policy

| Error Type | Detection Method | Retry Policy |
|---|---|---|
| AGY process crash | Non-zero exit code | Retry 2x with backoff |
| Timeout | Process exceeds `--print-timeout` | Retry 1x with longer timeout |
| Invalid JSON output | JSON parse failure | Retry 1x |
| Schema validation fail | Zod validation error | Retry 1x with clarified prompt instructions |
| Empty/useless content | Content quality check (`EMPTY` / `PARTIAL`) | Mark as partial, try alternate source |
| Rate limiting | HTTP 429 in content | Exponential backoff |
| Auth required | Login page detected (`AUTH_REQUIRED`) | Emit event, pause task |

---

## 7. Content Quality Assessment

Since `read_url_content` does not execute JavaScript, heuristics are required to detect SPAs or blocked pages:
- **Length Threshold:** Content < 500 chars (after stripping HTML/Markdown links) = likely an SPA stub.
- **Redirects:** Detect common login redirect paths (e.g., `/login`, `/auth`, `auth0`).
- **HTTP Errors:** Detect 403 Forbidden or 401 Unauthorized messages within the text.
- **Classification:** Results categorized into `FULL`, `PARTIAL`, `EMPTY`, `AUTH_REQUIRED`, or `ERROR`.

---

## 8. Conversation Resumption

- Each successful AGY invocation returns a `conversation_id`.
- The Node orchestrator stores this `conversation_id` with the task record.
- If a task requires follow-up, the system can use `--conversation <id>` (or `--continue`) to resume the session with prior context loaded.
- *Note: Multi-turn tasks in print mode require careful verification to ensure context behaves exactly as expected.*

---

## 9. Cost & Usage Tracking

- Every JSON response from AGY includes `usage.input_tokens`, `usage.output_tokens`, `usage.thinking_tokens`, and `usage.total_tokens`.
- The Orchestrator extracts this usage object on every run.
- Metrics are tracked on a per-task, per-run, and cumulative basis.
- Data is aggregated and exposed via the administrative dashboard for cost monitoring.
