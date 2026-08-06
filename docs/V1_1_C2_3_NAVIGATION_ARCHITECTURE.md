# V1.1-C2.3 Navigation Architecture Cleanup

## Objective
This document outlines the strict architectural correction made to JobSight's navigation strategy to resolve React hydration failures and "invalid DOM nesting" errors. 

## Problem Identified
Next.js `<Link>` components strictly map to HTML `<a>` tags. Wrapping composite interactive components (like `JobCard`, `CompanyCard`, `MetricCard`) inside `<Link>` creates invalid HTML when those cards themselves contain secondary links (e.g., remote tags, tags filtering by decision, or quick action links). This results in severe `<a> cannot be descendant of <a>` hydration and structural errors.

## New Navigation Architecture Adopted
- **Interactive Cards MUST NEVER be wrapped in `<Link>`.** 
- Instead, cards implement structural routing internally.
- The Card handles primary click actions using `useRouter().push('/path')` applied to the top-level `<div>`.
- Accessibility is manually preserved via `role="button"`, `tabIndex={0}`, and `onKeyDown` listeners capturing `Enter` and `Space`.
- Internal links (`<Link>`) are reserved strictly for nested child entities (like filtering badges, metadata actions, and tags).

## Steps Completed

### 1. Audited Project
Scanned the entire routing tree for instances of interactive cards (`MetricCard`, `JobCard`, `Card`) inside `<Link>` elements.
- Found lingering `<Link>` wrappers in:
  - `src/app/page.tsx` (Dashboard wrapping `MetricCard`)
  - `src/app/jobs/page.tsx` (Jobs List wrapping `JobCard`)
  - `src/app/companies/page.tsx` (Companies list wrapping `Card`)
  - `src/app/companies/[id]/page.tsx` (Company Profile wrapping `MetricCard`)
  - `src/app/hunts/page.tsx` (Hunts List wrapping `Card`)

### 2. Component Refactoring
- **`MetricCard`**: Upgraded into a strictly-typed Client Component accepting an optional `href`. Internalized `useRouter` and keyboard-accessible listeners.
- **`InteractiveCard`**: Built a new foundational Client Component wrapper (`src/components/ui/InteractiveCard.tsx`) to replace naive `<Link><Card>...</Card></Link>` blocks.
- **`JobCard`**: Had been previously modified in C2.2 but its external wrapper `<Link>` was finally stripped from the Jobs Explorer list view.

### 3. Hydration & Validation Check
Verified no remaining `<a>` inside `<a>` exist in `src/app`. Run manual inspection ensuring hydration works smoothly on initial render with 0 console warnings.

### 4. Build Status
- `npm run typecheck`: Passed
- `npm run test`: Passed (106 tests, 25 suites)
- `npm run build`: Passed (0 errors, successful static prerender)

## Rule
Update `AGENTS.md` (or relevant coding guidelines) with the following rule:
**"Interactive cards must always use router.push() from a div/button wrapper. `<Link>` components are reserved only for nested entities."**
