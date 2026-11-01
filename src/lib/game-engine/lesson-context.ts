import { offlineLesson } from "../lesson/engine";
import { resolveCurriculumContext, type CurriculumContext } from "./curriculum-context";
import type { GameChallenge } from "./types";

/**
 * Lesson & Context integration (Step 03): connects a game challenge
 * to the existing Lesson & Context Engine (`offlineLesson`, the same
 * deterministic fallback the lesson system itself uses). The game
 * never duplicates lesson content and never requires an AI service:
 * when lesson context cannot be resolved, a safe static context built
 * from the challenge's own learning objective is returned instead.
 */
export interface ChallengeContext {
  curriculum: CurriculumContext | null;
  /** Short concept explanation for the student/teacher surface. */
  conceptExplanation: string;
  learningObjective: string;
  prerequisites: string[];
  /** Mission-level framing, e.g. "Mission 1 · warm-up". */
  missionContext: string;
  /** Progressive hints are served separately by the session API. */
  hintLevelsAvailable: number;
  /** "lesson-engine" when real lesson context resolved, else "static-fallback". */
  contextSource: "lesson-engine" | "static-fallback";
}

export function resolveChallengeContext(input: {
  challenge: GameChallenge;
  missionTitle: string;
  hintLevels?: number;
}): ChallengeContext {
  const { challenge } = input;
  const curriculum = resolveCurriculumContext({
    classLevel: challenge.grade,
    topicId: challenge.topicId ?? "",
    difficulty: challenge.difficulty ?? 1,
  });
  const stageText = challenge.stage === "warmup" ? "warm-up" : challenge.stage === "final" ? "final challenge" : "main challenge";
  const missionContext = `${input.missionTitle} · ${stageText}`;
  const learningObjective = challenge.learningObjective ?? curriculum?.learningObjective ?? "";
  try {
    const lesson = offlineLesson(challenge.grade, challenge.topicId);
    const firstExplanation = lesson.explanations[0];
    return {
      curriculum,
      conceptExplanation: firstExplanation ? `${firstExplanation.title}: ${firstExplanation.body}` : lesson.introduction,
      learningObjective,
      prerequisites: curriculum?.prerequisites ?? [],
      missionContext,
      hintLevelsAvailable: input.hintLevels ?? 0,
      contextSource: "lesson-engine",
    };
  } catch {
    return {
      curriculum,
      conceptExplanation: learningObjective
        ? `In this challenge you will practise: ${learningObjective.charAt(0).toLowerCase()}${learningObjective.slice(1)}`
        : "Take it one small step at a time, and use the hints whenever you need them.",
      learningObjective,
      prerequisites: curriculum?.prerequisites ?? [],
      missionContext,
      hintLevelsAvailable: input.hintLevels ?? 0,
      contextSource: "static-fallback",
    };
  }
}
