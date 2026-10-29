import type {
  ClassmatePersonaState,
  PersonaFidelity,
  TaskSchema,
} from "./types";

/* ------------------------------------------------------------------ */
/* Persona fidelity guardrail (§7): lightweight post-generation check   */
/* comparing the utterance against the persona schema. Flags drift     */
/* when the classmate states the correct answer (solution-snapping)    */
/* or breaks peer character — without the learner having addressed     */
/* the underlying concept. Deterministic and lexical by design: it is  */
/* a production guardrail, not a semantic judge.                       */
/* ------------------------------------------------------------------ */

/** Solution-snapping phrasings: the MathVC persona-misalignment failure. */
const CORRECT_ANSWER_PATTERNS: RegExp[] = [
  /actually,?\s+(the answer is|it's|it is)/i,
  /the (correct|right) answer is/i,
  /here'?s the solution/i,
  /let me (teach you|explain the correct)/i,
];

/** The "helpful assistant" pretraining leaking through peer character. */
const PERSONA_BREAK_PATTERNS: RegExp[] = [
  /\bas an ai\b/i,
  /\bas a (language model|tutor|teacher|ai assistant)\b/i,
  /\bi'?m (a tutor|an ai|your (tutor|teacher))\b/i,
];

export interface FidelityCheckInput {
  utteranceText: string;
  personaState: ClassmatePersonaState;
  taskSchema?: TaskSchema;
  learnerAddressedConcept: boolean;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkPersonaFidelity(input: FidelityCheckInput): PersonaFidelity {
  const { utteranceText, taskSchema, learnerAddressedConcept } = input;

  for (const pattern of PERSONA_BREAK_PATTERNS) {
    if (pattern.test(utteranceText)) {
      return {
        belief_state_preserved: false,
        drift_detected: true,
        detail: `persona break: utterance matches ${pattern}`,
      };
    }
  }

  // A conceptually-addressed learner earns a belief update; without that
  // signal, any correct-answer statement is drift (§3.1).
  if (!learnerAddressedConcept) {
    for (const pattern of CORRECT_ANSWER_PATTERNS) {
      if (pattern.test(utteranceText)) {
        return {
          belief_state_preserved: false,
          drift_detected: true,
          detail: `solution-snapping phrasing: utterance matches ${pattern}`,
        };
      }
    }
    const correct = taskSchema ? normalize(taskSchema.correct_answer) : "";
    if (correct.length >= 3 && normalize(utteranceText).includes(correct)) {
      return {
        belief_state_preserved: false,
        drift_detected: true,
        detail: "utterance states the task schema's correct answer verbatim",
      };
    }
  }

  return { belief_state_preserved: true, drift_detected: false };
}
