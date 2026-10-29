/**
 * Prompt templates (§4), role-framed and concise: every instruction block is
 * capped at 200 tokens. Context (textbook excerpt, objectives) is injected as
 * data below the instruction. Each prompt carries a [TEMPLATE:X] marker so
 * test doubles can route deterministically.
 */

export interface BuiltPrompt {
  /** The instruction block alone — the part subject to the token cap. */
  instruction: string;
  /** Full prompt sent to the model: marker + instruction + injected context. */
  text: string;
}

/** Rough token estimate (words × 1.3) for enforcing the §4 budget in tests. */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

export const INSTRUCTION_TOKEN_BUDGET = 200;

/* ---------------- Template A: micro-lesson (five-message arc) ---------------- */

export interface MicroLessonPromptArgs {
  classLevel: number;
  subject: string;
  conceptName: string;
  textbookName: string;
  chapterTitle: string;
  learningObjectiveText: string;
  masteredPrerequisites: string[];
  difficulty: number;
  bloomLevel: string;
  textbookExcerpt: string;
}

export function buildMicroLessonPrompt(args: MicroLessonPromptArgs): BuiltPrompt {
  const instruction =
    `[ROLE] Expert CBSE curriculum designer for Class ${args.classLevel} ${args.subject}. ` +
    `[TASK] Generate a 5-message micro-lesson for the target concept below. ` +
    `Messages: 1 HOOK — why it matters, Indian daily-life context. ` +
    `2 CORE — one-sentence definition plus one sentence of meaning. ` +
    `3 EXAMPLE — concrete and relatable, familiar objects or numbers. ` +
    `4 MISCONCEPTION — the most common student mistake, corrected. ` +
    `5 TAKEAWAY — one actionable thing for today. ` +
    `[CONSTRAINT] Each message ≤160 characters. Use ONLY terminology from the NCERT excerpt. ` +
    `No external jargon. Output JSON only: {"messages": [{"seq": 1, "type": "hook", "text": "..."}, ...]}.`;
  const text =
    `[TEMPLATE:A]\n${instruction}\n` +
    `[CONTEXT]\n` +
    `- Target Concept: ${args.conceptName}\n` +
    `- Textbook Alignment: NCERT ${args.textbookName}, ${args.chapterTitle}\n` +
    `- NCF-SE 2023 Learning Outcome: "${args.learningObjectiveText}"\n` +
    `- Active Prerequisites (Mastered): ${args.masteredPrerequisites.join("; ") || "none"}\n` +
    `- Difficulty: ${args.difficulty}/1.0 | Bloom Level: ${args.bloomLevel}\n` +
    `- NCERT Excerpt: """${args.textbookExcerpt}"""`;
  return { instruction, text };
}

/* ---------------- Template B: full teaching script (40 min) ---------------- */

export interface TeachingScriptPromptArgs {
  classLevel: number;
  subject: string;
  chapterTitle: string;
  conceptNames: string[];
  objectiveTexts: string[];
  allHardPrerequisitesMet: boolean;
  prerequisiteConcepts: string[];
  textbookExcerpt: string;
}

export function buildTeachingScriptPrompt(args: TeachingScriptPromptArgs): BuiltPrompt {
  const instruction =
    `[ROLE] Senior CBSE Master Teacher, 15 years teaching ${args.subject} to Class ${args.classLevel}. ` +
    `[TASK] Write a 40-minute classroom script for the concepts below. ` +
    `Sections: 1 PREREQUISITE RECAP (5 min) — activate prior knowledge, ask 2 diagnostic questions. ` +
    `2 CONCEPT INTRODUCTION (10 min) — local example, define with textbook terms. ` +
    `3 GUIDED PRACTICE (15 min) — solve one NCERT example step by step, verbalize reasoning. ` +
    `4 INDEPENDENT CHECK (8 min) — one competency-based case-study question, CBSE pattern. ` +
    `5 CLOSURE (2 min) — 3-bullet summary plus one micro-homework. ` +
    `[CONSTRAINT] If a hard prerequisite is unmet, prepend a 5-minute Bridge Activity. ` +
    `Cite the NCERT page number for each definition. Indian English (maths, marks). ` +
    `Output JSON only: {"sections": [{"title": ..., "durationMin": ..., "body": ...}]}.`;
  const text =
    `[TEMPLATE:B]\n${instruction}\n` +
    `[CONTEXT]\n` +
    `- Chapter: ${args.chapterTitle} (NCERT)\n` +
    `- Concepts: ${args.conceptNames.join("; ")}\n` +
    `- Learning Objectives (verbatim NCF-SE): ${args.objectiveTexts.map((t) => `"${t}"`).join("; ") || "none mapped"}\n` +
    `- Prerequisite Status: all_hard_prerequisites_met=${args.allHardPrerequisitesMet}\n` +
    `- Prerequisite Concepts: ${args.prerequisiteConcepts.join("; ") || "none"}\n` +
    `- NCERT Excerpt: """${args.textbookExcerpt}"""`;
  return { instruction, text };
}

/* ---------------- Template C: prerequisite remediation drill ---------------- */

export interface RemediationPromptArgs {
  classLevel: number;
  targetConcept: string;
  missingPrerequisite: string;
}

export function buildRemediationPrompt(args: RemediationPromptArgs): BuiltPrompt {
  const instruction =
    `[ROLE] Patient remedial tutor for Class ${args.classLevel}. ` +
    `[TASK] The student needs "${args.targetConcept}" but has not mastered "${args.missingPrerequisite}". ` +
    `Write a 3-minute bridge explanation of the missing prerequisite: simplest language, ` +
    `one visual analogy described in words. ` +
    `Output JSON only with exactly 3 paragraphs: ` +
    `{"missingPrerequisite": ..., "bridgeLesson": {"paragraphs": [what-it-is, why-it-matters-next, self-check-question]}}.`;
  return { instruction, text: `[TEMPLATE:C]\n${instruction}` };
}

/** Appended to Template B on similarity-rejection retry (§3.2). */
export const STRICT_RETRY_CONSTRAINT =
  `STRICT RETRY: the previous draft failed textbook alignment. ` +
  `Reuse exact NCERT terms from the excerpt, add no new nouns, ` +
  `and keep every sentence checkable against the excerpt.`;
