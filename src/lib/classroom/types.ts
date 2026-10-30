import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Agent registry (§2): the structured object the Director and the      */
/* frontend both read. Exactly one teacher, ≥1 fallible classmate.      */
/* ------------------------------------------------------------------ */

export const AgentRoleSchema = z.enum(["teacher", "assistant", "classmate"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

/**
 * Persona facets. Teacher facets (warmth, pace, explanation_style, humor)
 * and classmate facets (proficiency, curiosity, confidence,
 * misconception_bias) share one schema; prompt builders apply per-role
 * defaults for missing keys so the registry stays forward-compatible.
 */
export const PersonaTraitsSchema = z.object({
  warmth: z.number().min(0).max(1).optional(),
  pace: z.enum(["slow", "moderate", "fast"]).optional(),
  explanation_style: z.enum(["socratic", "direct", "analogical", "visual"]).optional(),
  humor: z.number().min(0).max(1).optional(),
  proficiency: z.number().min(0).max(1).optional(),
  curiosity: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  misconception_bias: z.array(z.string().min(1)).optional(),
});
export type PersonaTraits = z.infer<typeof PersonaTraitsSchema>;

/**
 * MathVC persona schema (§3.1): the student-specific representation the
 * classmate LLM is instructed to inhabit. It may contain deliberate
 * misconceptions; belief updates require conceptual addressing, not
 * surface correction.
 */
export const ClassmatePersonaStateSchema = z.object({
  misconception_id: z.string().min(1),
  misconception_statement: z.string().min(1),
  /** 0–1 scale; drives how hard the classmate defends its belief. */
  confidence: z.number().min(0).max(1),
  reasoning_pattern: z.string().min(1),
  partial_update_statement: z.string().min(1),
});
export type ClassmatePersonaState = z.infer<typeof ClassmatePersonaStateSchema>;

/** MathVC task schema (§3.1): ground truth for the current problem. */
export const TaskSchemaSchema = z.object({
  problem_statement: z.string().min(1),
  solution_path: z.array(z.string().min(1)).min(1),
  correct_answer: z.string().min(1),
  key_terms: z.array(z.string().min(1)).default([]),
});
export type TaskSchema = z.infer<typeof TaskSchemaSchema>;

export const AgentDefinitionSchema = z.object({
  agent_id: z.string().min(1),
  role: AgentRoleSchema,
  display_name: z.string().min(1),
  persona_traits: PersonaTraitsSchema,
  voice_id: z.string().min(1),
  expertise: z.array(z.string().min(1)).default([]),
  speaking_priority: z.number().int().min(0).max(10),
  can_draw_whiteboard: z.boolean().default(false),
  can_make_mistakes: z.boolean().default(false),
  /** Required for every fallible classmate; used by prompts + fidelity. */
  persona_state: ClassmatePersonaStateSchema.optional(),
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export const ClassroomRegistrySchema = z.object({
  classroom_id: z.string().min(1),
  subject: z.string().min(1).default("Mathematics"),
  class_level: z.number().int().min(1).max(12).default(8),
  local_context: z.string().min(1).default("Indian daily life"),
  task_schema: TaskSchemaSchema.optional(),
  agents: z.array(AgentDefinitionSchema).min(1),
});
export type ClassroomRegistry = z.infer<typeof ClassroomRegistrySchema>;

/* ------------------------------------------------------------------ */
/* Director state + decision contract (§4). The Director holds the      */
/* authoritative state; agents are stateless.                          */
/* ------------------------------------------------------------------ */

/** Five-stage CPS phase machine (§4.3). Order is significant. */
export const PedagogicalPhaseSchema = z.enum([
  "shared_understanding",
  "team_organization",
  "planning",
  "execution",
  "validation",
]);
export type PedagogicalPhase = z.infer<typeof PedagogicalPhaseSchema>;

export const MoveTypeSchema = z.enum([
  "direct_instruction",
  "checkpoint",
  "misconception_exposure",
  "clarifying_question",
  "extension_question",
  "related_mistake",
  "thinking_aloud",
  "facilitation",
  "peer_explanation",
  "redirect",
  "student_response",
  "neutral",
]);
export type MoveType = z.infer<typeof MoveTypeSchema>;

export const DirectorReasonSchema = z.enum([
  "session_start",
  "learner_asked_question",
  "student_priority_after_error",
  "teacher_checkpoint_due",
  "classmate_misconception_exposed",
  "discussion_stalled",
  "strategic_delay_yield",
  "phase_transition",
  "teacher_redirect_after_drift",
  "scaffold_fade_peer_routing",
  "llm_selected",
  "priority_fallback",
  "session_complete",
]);
export type DirectorReason = z.infer<typeof DirectorReasonSchema>;

export const TurnHistoryEntrySchema = z.object({
  turn_id: z.string().min(1),
  speaker_id: z.string().min(1),
  role: z.enum(["teacher", "assistant", "classmate", "student"]),
  move_type: MoveTypeSchema,
  text_preview: z.string().max(280),
});
export type TurnHistoryEntry = z.infer<typeof TurnHistoryEntrySchema>;

export const ClassroomModeSchema = z.enum(["voice", "text_fallback"]);
export type ClassroomMode = z.infer<typeof ClassroomModeSchema>;

/** Authoritative Director state, echoed back by the client each turn. */
export const DirectorStateSchema = z.object({
  phase: PedagogicalPhaseSchema,
  scaffold_level: z.number().min(0).max(1),
  /** Ticks elapsed (agent + student turns). Drives scaffold fade. */
  turn_count: z.number().int().min(0),
  classmate_utterances_since_checkpoint: z.number().int().min(0),
  consecutive_teacher_turns: z.number().int().min(0),
  last_speaker_id: z.string().nullable(),
  last_move_type: MoveTypeSchema.nullable(),
  /** Set after a strategic-delay interjection; next tick yields to student. */
  pending_student_yield: z.boolean(),
  /** Counts strategic-delay triggers in text mode (every other is skipped). */
  text_mode_skips: z.number().int().min(0),
  last_checkpoint: z.enum(["passed", "failed", "not_attempted"]),
  validation_passed: z.boolean(),
  mode: ClassroomModeSchema,
  /** Bounded window (see HISTORY_WINDOW); newest last. */
  history: z.array(TurnHistoryEntrySchema),
});
export type DirectorState = z.infer<typeof DirectorStateSchema>;

export const DirectorDecisionSchema = z.object({
  /** agent_id, or the pseudo-speakers "student" / "terminate". */
  next_speaker: z.string().min(1),
  reason: DirectorReasonSchema,
  scaffold_level: z.number().min(0).max(1),
  wait_for_student_seconds: z.number().int().min(0),
});
export type DirectorDecision = z.infer<typeof DirectorDecisionSchema>;

export const STUDENT_SPEAKER = "student";
export const TERMINATE_SPEAKER = "terminate";

/* ------------------------------------------------------------------ */
/* Agent turn generation (§3, §6, §7)                                   */
/* ------------------------------------------------------------------ */

export const AdaptationSignalsSchema = z.object({
  learner_emotion: z.enum(["calm", "frustrated", "excited", "confused"]),
  learner_comprehension: z.enum(["low", "medium", "high"]),
  last_checkpoint: z.enum(["passed", "failed", "not_attempted"]),
});
export type AdaptationSignals = z.infer<typeof AdaptationSignalsSchema>;

export const WhiteboardActionSchema = z.object({
  action: z.enum(["write", "draw", "highlight", "clear"]),
  content: z.string().min(1).max(280),
});
export type WhiteboardAction = z.infer<typeof WhiteboardActionSchema>;

/** Structured LLM output for one agent utterance (generate_agent_turn). */
export const AgentUtteranceSchema = z.object({
  text: z.string().min(1).max(600),
  move_type: MoveTypeSchema,
  misconception_id: z.string().nullable().default(null),
  invites_student_response: z.boolean().default(false),
  whiteboard_actions: z.array(WhiteboardActionSchema).default([]),
});
export type AgentUtterance = z.infer<typeof AgentUtteranceSchema>;

export const PersonaFidelitySchema = z.object({
  belief_state_preserved: z.boolean(),
  drift_detected: z.boolean(),
  detail: z.string().optional(),
});
export type PersonaFidelity = z.infer<typeof PersonaFidelitySchema>;

/** Typed classroom turn payload delivered to Director + frontend (§7). */
export const ClassroomTurnSchema = z.object({
  turn_id: z.string().min(1),
  speaker: z.object({
    agent_id: z.string().min(1),
    display_name: z.string().min(1),
    role: AgentRoleSchema,
  }),
  content: z.object({
    text: z.string().min(1),
    speech_audio_url: z.string().nullable(),
    duration_ms: z.number().int().nonnegative(),
  }),
  pedagogical_annotation: z.object({
    move_type: MoveTypeSchema,
    misconception_id: z.string().nullable(),
    invites_student_response: z.boolean(),
  }),
  persona_fidelity: PersonaFidelitySchema,
  whiteboard_actions: z.array(WhiteboardActionSchema),
  mode: ClassroomModeSchema,
});
export type ClassroomTurn = z.infer<typeof ClassroomTurnSchema>;

/* ------------------------------------------------------------------ */
/* Turn API I/O                                                        */
/* ------------------------------------------------------------------ */

export const ClassroomTurnRequestSchema = z.object({
  /** Omitted → default 1 Teacher + 1 Assistant + 4 Classmates composition. */
  registry: ClassroomRegistrySchema.optional(),
  /** Omitted → fresh Director state (session start). */
  state: DirectorStateSchema.optional(),
  /** The learner's last message, if any, since the previous tick. */
  student_input: z.string().max(2000).optional(),
  /** Was the learner's last answer correct? Drives extension vs remediation. */
  student_answer_correct: z.boolean().nullable().default(null),
  student_silence_seconds: z.number().min(0).max(600).default(0),
  /** The exact sub-topic being taught right now; classmates must ask about this. */
  topic: z.object({
    title: z.string().min(1).max(200),
    keywords: z.array(z.string().min(1).max(80)).max(8).default([]),
    summary: z.string().max(600).default(""),
  }).optional(),
  adaptation: AdaptationSignalsSchema.default({
    learner_emotion: "calm",
    learner_comprehension: "medium",
    last_checkpoint: "not_attempted",
  }),
  /**
   * True when the learner's input addressed the underlying misconception
   * (not merely the surface error). Gates classmate belief updates (§3.1).
   */
  learner_addressed_concept: z.boolean().default(false),
});
export type ClassroomTurnRequest = z.infer<typeof ClassroomTurnRequestSchema>;

export const ClassroomTurnResponseSchema = z.object({
  classroom_id: z.string().min(1),
  decision: DirectorDecisionSchema,
  /** Null when the Director routes to the student or terminates. */
  turn: ClassroomTurnSchema.nullable(),
  state: DirectorStateSchema,
  registry: ClassroomRegistrySchema,
});
export type ClassroomTurnResponse = z.infer<typeof ClassroomTurnResponseSchema>;

/* ------------------------------------------------------------------ */
/* Structured errors                                                   */
/* ------------------------------------------------------------------ */

export const ClassroomErrorSchema = z.object({
  error: z.string().min(1),
  classroom_id: z.string(),
  detail: z.string().optional(),
});
export type ClassroomError = z.infer<typeof ClassroomErrorSchema>;

/**
 * Thrown for request-level (4xx) and infrastructure (5xx) failures; routes
 * map it to a ClassroomError with the carried HTTP status.
 */
export class ClassroomException extends Error {
  readonly code: string;
  readonly classroomId: string;
  readonly httpStatus: number;

  constructor(code: string, classroomId: string, httpStatus: number, message?: string) {
    super(message ?? code);
    this.name = "ClassroomException";
    this.code = code;
    this.classroomId = classroomId;
    this.httpStatus = httpStatus;
  }

  toPayload(): ClassroomError {
    return { error: this.code, classroom_id: this.classroomId, detail: this.message };
  }
}
