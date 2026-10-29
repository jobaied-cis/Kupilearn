import type { TaskSchema, TurnHistoryEntry } from "./types";

/* ------------------------------------------------------------------ */
/* Contextual question generation (§6): classmates ask useful           */
/* questions keyed to three triggers — never random ones.              */
/* ------------------------------------------------------------------ */

export type QuestionTrigger = "boundary_clarification" | "extension" | "related_mistake";

export interface QuestionContext {
  history: TurnHistoryEntry[];
  /** Correctness of the learner's last answer, when known. */
  studentAnswerCorrect: boolean | null;
}

/**
 * Selects the question trigger from the latest classroom events:
 * - teacher just defined a term → boundary clarification;
 * - learner correct → one-level-deeper extension;
 * - learner wrong → a related mistake inviting error diagnosis (highest value).
 * Returns null when no trigger matches (standard persona turn instead).
 */
export function selectQuestionTrigger(context: QuestionContext): QuestionTrigger | null {
  const last = context.history[context.history.length - 1];
  if (!last) return null;
  if (context.studentAnswerCorrect === false) return "related_mistake";
  if (context.studentAnswerCorrect === true) return "extension";
  if (last.role === "teacher" && last.move_type === "direct_instruction") {
    return "boundary_clarification";
  }
  return null;
}

/** Renders the trigger as a brief injected into the classmate prompt. */
export function questionBriefFor(trigger: QuestionTrigger, taskSchema?: TaskSchema): string {
  const problem = taskSchema ? ` The problem is: ${taskSchema.problem_statement}` : "";
  switch (trigger) {
    case "boundary_clarification":
      return (
        `BOUNDARY CLARIFICATION: the teacher just defined a term. Ask a clarifying question ` +
        `that tests the boundary of that definition ("So does that mean [edge case] is also included?").${problem}`
      );
    case "extension":
      return (
        `EXTENSION: the learner just answered correctly. Ask a question that pushes one level deeper ` +
        `("But what happens if we change [variable]?").${problem}`
      );
    case "related_mistake":
      return (
        `RELATED MISTAKE: the learner just answered wrong. Make a related mistake of your own: assert a ` +
        `wrong value with plausible-but-flawed reasoning from your belief state, then ask why it isn't right. ` +
        `Do NOT state the correct answer. Your job is to invite the learner to compare reasoning.${problem}`
      );
  }
}
