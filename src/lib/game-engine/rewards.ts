import type { GameResult } from "./types";

/**
 * Reward Engine (Step 05): safe, transparent, server-side only.
 *
 * XP rules (fixed and published here — nothing client-supplied is
 * ever read):
 * - +10 XP per correctly answered challenge (understanding, not speed)
 * - +25 XP for completing a mission
 * - +15 XP when the final independent challenge is correct without hints
 * Incorrect answers never subtract XP. There are no streaks, timers,
 * loot, rankings, or leaderboards anywhere in this design.
 *
 * Awards are computed once per session id by `RewardLedger`, so
 * repeated submissions or result re-reads can never double-award.
 */

export const XP_RULES = {
  perCorrectChallenge: 10,
  missionComplete: 25,
  independentFinalNoHints: 15,
} as const;

export interface ChallengeOutcome {
  challengeId: string;
  mechanicId: string;
  stage?: "warmup" | "main" | "final";
  correct: boolean;
  hintsUsed: number;
  learningObjective?: string;
}

export interface XpBreakdown {
  challengeXp: number;
  completionXp: number;
  independentXp: number;
  total: number;
}

export function computeXp(outcomes: ChallengeOutcome[], missionCompleted: boolean): XpBreakdown {
  const challengeXp = outcomes.filter((o) => o.correct).length * XP_RULES.perCorrectChallenge;
  const completionXp = missionCompleted ? XP_RULES.missionComplete : 0;
  const final = outcomes.find((o) => o.stage === "final");
  const independentXp = missionCompleted && final?.correct && final.hintsUsed === 0 ? XP_RULES.independentFinalNoHints : 0;
  return { challengeXp, completionXp, independentXp, total: challengeXp + completionXp + independentXp };
}

export interface BadgeDefinition {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-mission",
    name: "First Mission",
    nameBn: "প্রথম মিশন",
    description: "Complete your first Puzzle Quest mission.",
    icon: "compass",
  },
  {
    id: "puzzle-solver",
    name: "Puzzle Solver",
    nameBn: "ধাঁধা সমাধানকারী",
    description: "Finish every challenge in a mission.",
    icon: "target",
  },
  {
    id: "independent-thinker",
    name: "Independent Thinker",
    nameBn: "স্বাধীন চিন্তক",
    description: "Solve the final challenge correctly without using hints on it.",
    icon: "lightbulb",
  },
  {
    id: "concept-explorer",
    name: "Concept Explorer",
    nameBn: "ধারণা অনুসন্ধানী",
    description: "Answer correctly across at least four different puzzle types.",
    icon: "shapes",
  },
];

export interface ProgressAggregate {
  missionsCompleted: string[];
  totalXp: number;
  challengesAnswered: number;
  challengesCorrect: number;
  objectivesCovered: string[];
  mechanicsExplored: string[];
  badgesEarned: string[];
}

/** Deterministic badge eligibility over a progress aggregate + this session. */
export function evaluateBadges(input: {
  aggregate: ProgressAggregate;
  sessionOutcomes: ChallengeOutcome[];
  missionId: string;
  missionCompleted: boolean;
}): string[] {
  const earned = new Set(input.aggregate.badgesEarned);
  const fresh: string[] = [];
  const award = (id: string, ok: boolean) => {
    if (ok && !earned.has(id)) {
      earned.add(id);
      fresh.push(id);
    }
  };
  if (input.missionCompleted) {
    award("first-mission", input.aggregate.missionsCompleted.length >= 1);
    award("puzzle-solver", input.sessionOutcomes.length > 0); // mission completion already requires every challenge recorded
    const final = input.sessionOutcomes.find((o) => o.stage === "final");
    award("independent-thinker", Boolean(final?.correct && final.hintsUsed === 0));
  }
  award("concept-explorer", input.aggregate.mechanicsExplored.length >= 4);
  return fresh;
}

export interface RewardAward {
  sessionId: string;
  missionId: string;
  xp: XpBreakdown;
  badges: string[];
  result: GameResult;
  awardedAt: string;
}

/** One award per session id, forever (within the store's lifetime). */
export class RewardLedger {
  private awards = new Map<string, RewardAward>();

  award(input: Omit<RewardAward, "awardedAt"> & { awardedAt?: string }): { award: RewardAward; duplicate: boolean } {
    const existing = this.awards.get(input.sessionId);
    if (existing) return { award: existing, duplicate: true };
    const award: RewardAward = { ...input, awardedAt: input.awardedAt ?? new Date().toISOString() };
    this.awards.set(input.sessionId, award);
    return { award, duplicate: false };
  }

  get(sessionId: string): RewardAward | null {
    return this.awards.get(sessionId) ?? null;
  }
}
