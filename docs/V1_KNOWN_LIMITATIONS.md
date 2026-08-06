# V1 Known Limitations

While JobSight V1 is fully operational and reliable for real-world usage, it operates within certain known constraints and boundaries. These limitations are documented below to set clear expectations and guide V2 feature planning.

## 1. AGY AI Constraints
- **Hallucination Risk on Edge Cases**: The system forces strict validation schemas, but unstructured text extraction might occasionally miscategorize niche industry skills or extremely unconventional job descriptions. 
- **Latency**: Heavy dependency on AGY extraction can lead to pipeline delays during peak load.
- **Prompt Injection Defense**: Although structural safeguards exist (enforcing structured JSON extraction over arbitrary code execution), a highly adversarial job posting designed explicitly to disrupt the AI context window could theoretically result in an invalid JSON payload, which the pipeline safely catches as a validation failure.

## 2. Infrastructure & Local Processing
- **SQLite Concurrency**: Although WAL mode is enabled and foreign keys are enforced, heavy concurrent writes (e.g., launching multiple hunts simultaneously on the same local DB) could encounter `SQLITE_BUSY` errors.
- **No Remote Sync**: All data remains strictly local in `data/jobsight.db`. There is no built-in cloud backup out-of-the-box (beyond the manual `npm run db:backup` script).

## 3. Product & Feature Scope
- **No Auto-Apply**: V1 is strictly an intelligence, discovery, and qualification pipeline. It will not autonomously apply to jobs or send emails on behalf of the user.
- **Single Source of Truth**: The system assumes the user's `Profile` is static during a single Hunt execution. Changing profile details mid-hunt will not retroactively update past decisions.
- **No Direct Recruiter Outreach**: Generating personalized emails or outreach messages is out of scope for V1.

## 4. Stability
- Next.js 15 App Router is utilized with a Webpack build because Turbopack does not perfectly resolve `.js` node extensions mapped to `.ts` files locally.
- Idempotency relies on exact matching of canonical URLs. A job that is reposted on a totally different domain with a slightly altered title might still bypass the deduplication logic.
