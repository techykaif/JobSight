/**
 * Authoritative Decision Mapping — Phase 13 UI Integrity
 *
 * This module is the SINGLE SOURCE OF TRUTH for the mapping between
 * persisted CandidateDecisionState enums and human-readable UI labels
 * used on the Dashboard and Decision Board.
 *
 * Both Dashboard counts and Decision Board column buckets MUST use
 * these definitions so they always agree.
 *
 * Persisted decision states (from candidate-decision engine):
 *   APPLY | REVIEW | SKIP | INELIGIBLE | INSUFFICIENT_EVIDENCE
 *
 * Additional runtime state (not persisted by engine, but exists when
 * a job is observed in a run but has not yet been evaluated):
 *   PENDING  — represented as null/missing candidateDecisions row
 *
 * UI categories:
 *   Apply Now        ← APPLY
 *   Apply This Week  ← REVIEW
 *   Monitor          ← PENDING (null / no row)
 *   Research         ← INSUFFICIENT_EVIDENCE
 *   Rejected         ← SKIP + INELIGIBLE
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CandidateDecisionEnum =
  | 'APPLY'
  | 'REVIEW'
  | 'SKIP'
  | 'INELIGIBLE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PENDING';

export type UIDecisionCategory =
  | 'Apply Now'
  | 'Apply This Week'
  | 'Monitor'
  | 'Research'
  | 'Rejected';

// ── Authoritative mapping ────────────────────────────────────────────────────

/**
 * Maps a raw finalDecision value (which may be null for un-evaluated jobs)
 * to its canonical UI category.
 */
export function toUICategory(finalDecision: string | null | undefined): UIDecisionCategory {
  switch (finalDecision) {
    case 'APPLY':
      return 'Apply Now';
    case 'REVIEW':
      return 'Apply This Week';
    case 'INSUFFICIENT_EVIDENCE':
      return 'Research';
    case 'SKIP':
    case 'INELIGIBLE':
      return 'Rejected';
    case 'PENDING':
    case null:
    case undefined:
    default:
      return 'Monitor';
  }
}

/**
 * Maps a UI category back to the set of finalDecision enum values that
 * produce it. Used for filter queries.
 *
 * 'Monitor' maps to 'PENDING' which in the database layer means
 * either a row with finalDecision='PENDING' or no candidateDecisions row at all.
 */
export function toDecisionEnums(category: UIDecisionCategory): CandidateDecisionEnum[] {
  switch (category) {
    case 'Apply Now':
      return ['APPLY'];
    case 'Apply This Week':
      return ['REVIEW'];
    case 'Monitor':
      return ['PENDING'];
    case 'Research':
      return ['INSUFFICIENT_EVIDENCE'];
    case 'Rejected':
      return ['SKIP', 'INELIGIBLE'];
  }
}

/**
 * All UI categories in canonical display order.
 */
export const UI_DECISION_CATEGORIES: UIDecisionCategory[] = [
  'Apply Now',
  'Apply This Week',
  'Monitor',
  'Research',
  'Rejected',
];

/**
 * Maps a dashboard filter slug to a UI category.
 */
export function filterSlugToCategory(slug: string): UIDecisionCategory | null {
  switch (slug) {
    case 'apply-now':
      return 'Apply Now';
    case 'apply-this-week':
      return 'Apply This Week';
    case 'monitor':
      return 'Monitor';
    case 'research':
      return 'Research';
    case 'rejected':
      return 'Rejected';
    default:
      return null;
  }
}

/**
 * Maps a UI category to a dashboard filter slug.
 */
export function categoryToFilterSlug(category: UIDecisionCategory): string {
  switch (category) {
    case 'Apply Now':
      return 'apply-now';
    case 'Apply This Week':
      return 'apply-this-week';
    case 'Monitor':
      return 'monitor';
    case 'Research':
      return 'research';
    case 'Rejected':
      return 'rejected';
  }
}
