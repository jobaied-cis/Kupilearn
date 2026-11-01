import type { AdaptationDecision } from "./adaptive";
import type { MisconceptionSignal } from "./misconceptions";
import type { PerformanceSnapshot } from "./performance";

/**
 * Learning Recommendation Engine (Step 03): deterministic and
 * explainable. Priority order is fixed and inspectable — a repeated
 * error pattern suggests reviewing the prerequisite concept first;
 * otherwise the latest outcome, difficulty, and streaks decide.
 * Every recommendation carries its reason. No black box, no AI.
 */
export type RecommendationKind = "review-concept" | "retry" | "easier" | "continue" | "prerequisite";

export interface Recommendation {
  kind: RecommendationKind;
  message: string;
  reason: string;
  topicId?: string;
}

export function recommend(input: {
  lastRecordedCorrect: boolean | null;
  snapshot: PerformanceSnapshot;
  adaptation: AdaptationDecision;
  misconception: MisconceptionSignal | null;
  topicId?: string;
  prerequisites: string[];
  currentDifficulty: 1 | 2 | 3;
  sessionCompleted: boolean;
}): Recommendation {
  const { snapshot, adaptation } = input;
  if (input.sessionCompleted) {
    return {
      kind: "continue",
      message: "Quest complete — nicely done.",
      reason: "Every challenge in the mission has been recorded.",
      topicId: input.topicId,
    };
  }
  if (input.misconception) {
    return {
      kind: "review-concept",
      message: input.misconception.supportiveExplanation,
      reason: `The same error pattern appeared ${input.misconception.occurrences} times this session (${input.misconception.ruleId}).`,
      topicId: input.topicId,
    };
  }
  if (input.lastRecordedCorrect === false) {
    if (input.currentDifficulty > 1 && adaptation.difficulty < input.currentDifficulty) {
      return {
        kind: "easier",
        message: "Let us try an easier challenge next and build back up.",
        reason: adaptation.reason,
        topicId: input.topicId,
      };
    }
    if (input.prerequisites.length > 0) {
      return {
        kind: "prerequisite",
        message: `A quick look at "${input.prerequisites[0]}" first will make this easier.`,
        reason: "The last challenge was recorded incorrect and a prerequisite concept is available.",
        topicId: input.topicId,
      };
    }
    return {
      kind: "retry",
      message: "Have another look at the idea, then try a similar challenge.",
      reason: "The last challenge was recorded incorrect.",
      topicId: input.topicId,
    };
  }
  if (snapshot.currentCorrectStreak >= 3) {
    return {
      kind: "continue",
      message: "You are on a roll — keep going to the next challenge.",
      reason: "Three or more correct answers in a row this session.",
      topicId: input.topicId,
    };
  }
  return {
    kind: "continue",
    message: "Nice work — on to the next challenge.",
    reason: "Steady session progress.",
    topicId: input.topicId,
  };
}
