import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Domain model: Curriculum Concept Graph (§2.1 / §2.2 of the spec)     */
/* ------------------------------------------------------------------ */

export const BloomLevelSchema = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);
export type BloomLevel = z.infer<typeof BloomLevelSchema>;

export interface Subject {
  name: string;
}

export interface Chapter {
  id: string;
  title: string;
  classLevel: number;
  ncertCode: string;
  subject: string;
  textbookName: string;
}

export interface Concept {
  id: string;
  name: string;
  chapterId: string;
  bloomLevel: BloomLevel;
  /** 0–1 scale. */
  difficulty: number;
  masteryThreshold: number;
  isThresholdConcept: boolean;
}

export interface LearningObjective {
  id: string;
  /** Verbatim NCF-SE / NCERT text. */
  text: string;
  competencyCode: string;
  chapterId: string;
  conceptIds: string[];
}

export type PrerequisiteType = "hard" | "soft";

export interface PrerequisiteEdge {
  fromConceptId: string;
  toConceptId: string;
  type: PrerequisiteType;
}

/** One row of the prerequisite context window (§3.1). Depth ≤ 3 from target. */
export interface PrerequisiteInfo {
  id: string;
  name: string;
  masteryThreshold: number;
  type: PrerequisiteType;
  depth: number;
}

export interface ConceptDetails {
  concept: Concept;
  chapter: Chapter;
  objectives: LearningObjective[];
  /** BFS closure of prerequisites, depth ≤ 3. */
  prerequisites: PrerequisiteInfo[];
}

/* ------------------------------------------------------------------ */
/* Engine I/O: request, prerequisite context, API response (§3.1, §5)   */
/* ------------------------------------------------------------------ */

export const LessonRequestSchema = z.object({
  conceptId: z.string().min(1),
  /** Learner mastery per concept id, 0–1. Missing entries count as 0. */
  learnerMastery: z.record(z.string(), z.number().min(0).max(1)).default({}),
});
export type LessonRequest = z.infer<typeof LessonRequestSchema>;

export interface ActivePrerequisite {
  id: string;
  name: string;
  masteryThreshold: number;
  learnerMastery: number;
  depth: number;
}

export interface PrerequisiteContext {
  targetConcept: { id: string; name: string };
  activePrerequisites: ActivePrerequisite[];
  /** Ids of hard prerequisites the learner has not yet mastered. */
  gapFlags: string[];
}

export const EngineStatusSchema = z.enum([
  "ready",
  "remediation_required",
  "generation_failed",
]);
export type EngineStatus = z.infer<typeof EngineStatusSchema>;

export const MicroLessonMessageSchema = z.object({
  seq: z.number().int().min(1).max(5),
  type: z.enum(["hook", "core", "example", "misconception", "takeaway"]),
  text: z.string().min(1).max(160),
});
export type MicroLessonMessage = z.infer<typeof MicroLessonMessageSchema>;

export const MicroLessonSchema = z.object({
  messages: z.array(MicroLessonMessageSchema).length(5),
});
export type MicroLesson = z.infer<typeof MicroLessonSchema>;

export const TeachingScriptSectionSchema = z.object({
  title: z.string().min(1),
  durationMin: z.number().int().positive(),
  body: z.string().min(1),
});
export type TeachingScriptSection = z.infer<typeof TeachingScriptSectionSchema>;

export const TeachingScriptSchema = z.object({
  /** 5 standard sections + optional prepended Bridge Activity. */
  sections: z.array(TeachingScriptSectionSchema).min(5).max(6),
});
export type TeachingScript = z.infer<typeof TeachingScriptSchema>;

export const RemediationSchema = z.object({
  missingPrerequisite: z.string().min(1),
  bridgeLesson: z.object({
    /** Exactly 3 paragraphs: (1) what it is, (2) why it matters, (3) self-check. */
    paragraphs: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  }),
});
export type Remediation = z.infer<typeof RemediationSchema>;

/**
 * Strict API response (§5). `lesson_payload` / `validation` are null unless
 * a lesson was actually generated; `remediation` is present only when
 * `engine_status` is `remediation_required`.
 */
export const LessonResponseSchema = z.object({
  engine_status: EngineStatusSchema,
  concept_id: z.string(),
  curriculum_alignment: z.object({
    ncert_chapter: z.string(),
    ncf_competency_code: z.string(),
  }),
  prerequisite_audit: z.object({
    all_met: z.boolean(),
    missing_prerequisites: z.array(z.string()),
  }),
  lesson_payload: z
    .object({
      micro_lesson: MicroLessonSchema.nullable(),
      teaching_script: TeachingScriptSchema.nullable(),
    })
    .nullable(),
  validation: z
    .object({
      textbook_similarity_score: z.number().min(0).max(1).nullable(),
      bloom_level_verified: BloomLevelSchema,
    })
    .nullable(),
  remediation: RemediationSchema.optional(),
  /** Machine-readable failure reason, e.g. CONCEPT_NOT_MAPPED. */
  reason: z.string().optional(),
});
export type LessonResponse = z.infer<typeof LessonResponseSchema>;

/* ------------------------------------------------------------------ */
/* Structured error payloads (§1 guardrails, §6 error handling)         */
/* ------------------------------------------------------------------ */

export const EngineErrorSchema = z.object({
  error: z.string().min(1),
  concept_id: z.string(),
  detail: z.string().optional(),
});
export type EngineError = z.infer<typeof EngineErrorSchema>;

/** Thrown for infrastructure failures; routes map it to an EngineError + 503. */
export class EngineException extends Error {
  readonly code: string;
  readonly conceptId: string;

  constructor(code: string, conceptId: string, message?: string) {
    super(message ?? code);
    this.name = "EngineException";
    this.code = code;
    this.conceptId = conceptId;
  }

  toPayload(): EngineError {
    return { error: this.code, concept_id: this.conceptId, detail: this.message };
  }
}
