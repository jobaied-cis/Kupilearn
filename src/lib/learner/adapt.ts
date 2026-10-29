import { z } from "zod";

/**
 * Learner Personality Management (behavior-based only).
 * Guardrail: we adapt from observable learning behavior — pace, accuracy,
 * confidence answers, mistakes made in class, and chosen preferences.
 * We NEVER infer fixed intelligence or sensitive personality traits, and
 * every adaptation is explainable from the signals below.
 */

export const LearnerProfileSchema = z.object({
  name: z.string().default(""),
  education: z.enum(["school", "college", "university"]).default("school"),
  classLevel: z.number().int().min(6).max(10).default(6),
  /** Self-chosen, changeable anytime. */
  preferredStyle: z.enum(["step-by-step", "examples-first", "visual", "challenge"]).default("step-by-step"),
  pace: z.enum(["slow", "steady", "fast"]).default("steady"),
  quizCorrect: z.number().int().min(0).default(0),
  quizAttempted: z.number().int().min(0).default(0),
  /** Topics the learner asked to re-explain or got wrong (topic ids). */
  mistakeTopics: z.array(z.string()).default([]),
  /** Self-reported confidence 0..1 from checkpoint answers. */
  confidence: z.number().min(0).max(1).default(0.5),
  interactions: z.number().int().min(0).default(0),
  updatedAt: z.string().default(""),
});
export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

export function defaultLearner(name = "", education: LearnerProfile["education"] = "school"): LearnerProfile {
  return LearnerProfileSchema.parse({ name, education });
}

export interface Adaptation {
  difficulty: 1 | 2 | 3;
  scaffold: "high" | "medium" | "low";
  pace: LearnerProfile["pace"];
  style: LearnerProfile["preferredStyle"];
  reasons: string[];
}

/** Pure, testable adaptation decision from observable signals only. */
export function adaptLearner(p: LearnerProfile): Adaptation {
  const reasons: string[] = [];
  const accuracy = p.quizAttempted > 0 ? p.quizCorrect / p.quizAttempted : 0.5;
  let difficulty: Adaptation["difficulty"] = 2;
  if (p.quizAttempted >= 3 && accuracy >= 0.8 && p.confidence >= 0.6) {
    difficulty = 3;
    reasons.push("Recent answers are mostly correct and confidence is up, so challenge increases.");
  } else if ((p.quizAttempted >= 3 && accuracy < 0.5) || p.confidence < 0.35) {
    difficulty = 1;
    reasons.push("Recent answers or confidence are low, so we slow down with more support.");
  } else {
    reasons.push("Steady progress, so difficulty stays in the middle.");
  }
  if (p.mistakeTopics.length >= 2) reasons.push("Some topics were revisited, so revision comes before new challenge.");
  const scaffold: Adaptation["scaffold"] = difficulty === 1 ? "high" : difficulty === 3 ? "low" : "medium";
  return { difficulty, scaffold, pace: p.pace, style: p.preferredStyle, reasons };
}

export function recordAnswer(p: LearnerProfile, correct: boolean, topicId?: string): LearnerProfile {
  return {
    ...p,
    quizAttempted: p.quizAttempted + 1,
    quizCorrect: p.quizCorrect + (correct ? 1 : 0),
    confidence: Math.min(1, Math.max(0, p.confidence + (correct ? 0.05 : -0.07))),
    mistakeTopics: !correct && topicId && !p.mistakeTopics.includes(topicId)
      ? [...p.mistakeTopics.slice(-9), topicId]
      : p.mistakeTopics,
    interactions: p.interactions + 1,
    updatedAt: new Date().toISOString(),
  };
}
