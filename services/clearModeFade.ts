import type { ClearModeAppearance } from '../types';

// ── Clear Mode fade levels — automatic progression between support levels ──────────────────
// From the original design spec: "The adaptations fade as the candidate grows confident, until
// they can handle standard questions unaided." The spec names five levels (A full support, B
// checklist, C short hint, D standard, E real world + unexpected follow-up). This implements
// A, B and D only — the three levels that already have a real UI behind them
// (ClearModeAppearance: one_at_a_time / checklist / standard). C ("short hint") would need a new
// structure_hint field this app's question data doesn't have, and E ("unexpected follow-up")
// would need decideProbe changes; both are left as a documented, scoped-out extension rather than
// half-built. Tracked separately per question type (behavioural/motivational/situational/
// knowledge-probe), same grouping as the rest of this app already uses.
//
// "Rubric level 3 or above" in the spec maps to this app's existing starPhaseReached (0-4), the
// closest existing per-answer quality signal — there's no per-decoded-part rubric anywhere in
// this codebase, so this is a reasonable approximation of the spec's rule, not a literal
// implementation of it.

export type FadeLevel = 'A' | 'B' | 'D';

const LEVEL_TO_APPEARANCE: Record<FadeLevel, ClearModeAppearance> = {
  A: 'one_at_a_time', B: 'checklist', D: 'standard',
};
const APPEARANCE_TO_LEVEL: Record<ClearModeAppearance, FadeLevel> = {
  one_at_a_time: 'A', checklist: 'B', standard: 'D',
};
const LEVEL_ORDER: FadeLevel[] = ['A', 'B', 'D'];

export interface FadeTrackedAnswer {
  questionType?: 'behavioural' | 'motivational' | 'situational' | 'knowledge-probe';
  starPhaseReached: number;
  decoderUsed?: boolean;
  explainerUsed?: boolean;
}

export interface FadeDecision {
  newAppearance: ClearModeAppearance | null; // null = no change this time
  message: string | null; // shown to the candidate only when newAppearance is non-null
}

// Different wording depending on the target level — reaching 'standard' (D) genuinely matches
// the spec's exact line ("they'll now appear in their standard form"); an intermediate step up
// (A -> B) is a smaller change and needs its own accurate description, not the same line reused.
const UP_MESSAGE: Record<FadeLevel, string> = {
  A: '', // unreachable as a target — A is the lowest level, never stepped "up" into
  B: "You're covering these parts well on your own, so they'll now appear together as a checklist instead of one at a time. You can switch back at any time.",
  D: "You've been covering every part of these questions on your own, so they'll now appear in their standard form. You can switch back at any time.",
};
const DOWN_MESSAGE =
  "These questions will show a bit more structure for now, to help you find your footing. You can switch back to standard at any time.";

// Pure function — no side effects, so it can be unit-tested and called from a single useEffect
// without touching the rest of AscendPlatform.tsx's answer-submission logic.
export const computeFadeDecision = (
  historyForType: FadeTrackedAnswer[],
  currentAppearance: ClearModeAppearance,
): FadeDecision => {
  if (historyForType.length === 0) return { newAppearance: null, message: null };

  const currentLevel = APPEARANCE_TO_LEVEL[currentAppearance] ?? 'A';
  const levelIndex = LEVEL_ORDER.indexOf(currentLevel);

  // Up one level: rubric level 3+ reached unaided (no decoder, no visual explainer) in 2 of the
  // last 3 answers of this type.
  const last3 = historyForType.slice(-3);
  const unaidedStrongCount = last3.filter(
    a => a.starPhaseReached >= 3 && !a.decoderUsed && !a.explainerUsed
  ).length;
  if (unaidedStrongCount >= 2 && levelIndex < LEVEL_ORDER.length - 1) {
    const targetLevel = LEVEL_ORDER[levelIndex + 1];
    return { newAppearance: LEVEL_TO_APPEARANCE[targetLevel], message: UP_MESSAGE[targetLevel] };
  }

  // Down one level: 2 consecutive answers of this type missed rubric level 1 (starPhaseReached
  // 0) — this app has no separate "struggle_signals" counter, so a hard miss on the last two
  // answers is used as the down-level trigger instead.
  const last2 = historyForType.slice(-2);
  const strugglingLast2 = last2.length === 2 && last2.every(a => a.starPhaseReached <= 1);
  if (strugglingLast2 && levelIndex > 0) {
    return { newAppearance: LEVEL_TO_APPEARANCE[LEVEL_ORDER[levelIndex - 1]], message: DOWN_MESSAGE };
  }

  return { newAppearance: null, message: null };
};
