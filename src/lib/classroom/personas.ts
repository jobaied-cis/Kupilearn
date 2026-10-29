import type {
  AdaptationSignals,
  AgentDefinition,
  ClassmatePersonaState,
  DirectorState,
  TaskSchema,
  TurnHistoryEntry,
} from "./types";

/* ------------------------------------------------------------------ */
/* Persona prompt templates (§3). Each agent instance gets its own      */
/* constrained prompt: classmates optimize for coherence with their    */
/* belief state (not correctness), the teacher adapts to the learner.  */
/* Markers route the shared mock LLM client deterministically.         */
/* ------------------------------------------------------------------ */

export interface BuiltPrompt {
  /** The instruction block alone. */
  instruction: string;
  /** Full prompt: marker + instruction + injected context. */
  text: string;
}

/** Newest-last conversation slice for prompt context (bounded, untrimmed text avoided). */
export function formatHistoryForPrompt(history: TurnHistoryEntry[], maxEntries = 8): string {
  if (history.length === 0) return "No turns yet — this is the start of the session.";
  return history
    .slice(-maxEntries)
    .map((entry) => `- ${entry.speaker_id} (${entry.role}, ${entry.move_type}): ${entry.text_preview}`)
    .join("\n");
}

function utteranceFormatInstruction(): string {
  return (
    `Output JSON only: {"text": "<1-2 spoken sentences, ≤600 chars>", ` +
    `"move_type": "<one of: direct_instruction, checkpoint, misconception_exposure, ` +
    `clarifying_question, extension_question, related_mistake, thinking_aloud, facilitation, ` +
    `peer_explanation, redirect, neutral>", "misconception_id": "<id or null>", ` +
    `"invites_student_response": <true|false>, "whiteboard_actions": []}.`
  );
}

/* ---------------- Classmate: belief-maintenance objective (§3.2) ---------------- */

export interface ClassmatePromptArgs {
  agent: AgentDefinition;
  personaState: ClassmatePersonaState;
  taskSchema?: TaskSchema;
  classLevel: number;
  history: TurnHistoryEntry[];
  studentInput?: string;
  learnerAddressedConcept: boolean;
  /** Injected by contextual question generation (§6) when a trigger matches. */
  questionBrief?: string;
}

export function buildClassmatePrompt(args: ClassmatePromptArgs): BuiltPrompt {
  const { agent, personaState } = args;
  const traits = agent.persona_traits;
  const instruction =
    `[ROLE] You are ${agent.display_name}, a Class ${args.classLevel} student. You are NOT a tutor. You are a peer. ` +
    `[PERSONA STATE] Your current belief: "${personaState.misconception_statement}" ` +
    `Your confidence in this belief: ${personaState.confidence}/1.0. ` +
    `Your reasoning pattern: "${personaState.reasoning_pattern}" ` +
    `You do NOT know the correct answer. Do not pretend to. ` +
    `[TASK] Respond to the learner's last message as ${agent.display_name}. ` +
    `If the learner challenges you, defend your misconception using a plausible (but flawed) reason. ` +
    `If the learner explains WHY you are wrong at the conceptual level, show partial belief update: ` +
    `"${personaState.partial_update_statement}" ` +
    `Never state the correct answer. Never say "actually, the answer is..." ` +
    `Keep responses to 1-2 sentences. You are speaking aloud, not writing an essay. ` +
    utteranceFormatInstruction();
  const lines = [
    "[TEMPLATE:CLASSMATE]",
    instruction,
    "[CONTEXT]",
    `- Display Name: ${agent.display_name}`,
    `- Belief: ${personaState.misconception_statement}`,
    `- Confidence: ${personaState.confidence} | Curiosity: ${traits.curiosity ?? 0.5}`,
    `- Misconception ID: ${personaState.misconception_id}`,
    `- Learner Addressed Concept: ${args.learnerAddressedConcept ? "yes" : "no"}`,
  ];
  if (args.taskSchema) lines.push(`- Problem: ${args.taskSchema.problem_statement}`);
  if (args.questionBrief) lines.push(`- Question Brief: ${args.questionBrief}`);
  if (args.studentInput) lines.push(`- Learner Said: """${args.studentInput}"""`);
  lines.push("[HISTORY]", formatHistoryForPrompt(args.history));
  return { instruction, text: lines.join("\n") };
}

/* ---------------- Teacher: adaptive explanation (§3.3) ---------------- */

export interface TeacherPromptArgs {
  agent: AgentDefinition;
  signals: AdaptationSignals;
  classLevel: number;
  subject: string;
  localContext: string;
  history: TurnHistoryEntry[];
  studentInput?: string;
  taskSchema?: TaskSchema;
  /** True when a drifted classmate turn was withheld and must be redirected. */
  redirectAfterDrift?: boolean;
  /** True when this turn is a comprehension checkpoint. */
  isCheckpoint?: boolean;
}

export function buildTeacherPrompt(args: TeacherPromptArgs): BuiltPrompt {
  const { agent, signals } = args;
  const style = agent.persona_traits.explanation_style ?? "socratic";
  const redirect =
    args.redirectAfterDrift === true
      ? `[REDIRECT] A peer's line was withheld to protect the lesson. Do NOT mention the peer, the mistake, or any error. ` +
        `Give a warm, neutral bridge back to the problem in one sentence, then continue teaching. `
      : "";
  const instruction =
    `[ROLE] You are ${agent.display_name}, a ${args.subject} teacher for Class ${args.classLevel}. Your style: ${style}. ` +
    `[ADAPTATION SIGNALS] Learner emotion estimate: ${signals.learner_emotion}. ` +
    `Learner comprehension estimate: ${signals.learner_comprehension}. ` +
    `Last checkpoint: ${signals.last_checkpoint}. ` +
    `[EXPLANATION POLICY] If comprehension=low OR emotion=frustrated: break the concept into a smaller step. ` +
    `Use one concrete analogy from ${args.localContext}. Ask a yes/no checking question before proceeding. ` +
    `If comprehension=high AND emotion=excited: extend with a "what if" challenge. Increase pace. ` +
    `If checkpoint=failed: do not repeat the same explanation. Switch modality (e.g., from verbal to visual/whiteboard action). ` +
    redirect +
    `[CONSTRAINT] Use textbook terminology. Do not introduce jargon not present in the current chapter. ` +
    `Keep turns to 3 sentences or fewer because this is a spoken conversation. ` +
    utteranceFormatInstruction();
  const lines = [
    "[TEMPLATE:TEACHER]",
    instruction,
    "[CONTEXT]",
    `- Display Name: ${agent.display_name}`,
    `- Checkpoint Turn: ${args.isCheckpoint === true ? "yes" : "no"}`,
  ];
  if (args.taskSchema) {
    lines.push(`- Problem: ${args.taskSchema.problem_statement}`);
    lines.push(`- Key Terms: ${args.taskSchema.key_terms.join(", ") || "none"}`);
  }
  if (args.studentInput) lines.push(`- Learner Said: """${args.studentInput}"""`);
  lines.push("[HISTORY]", formatHistoryForPrompt(args.history));
  return { instruction, text: lines.join("\n") };
}

/* ---------------- Assistant: facilitation ---------------- */

export interface AssistantPromptArgs {
  agent: AgentDefinition;
  classLevel: number;
  subject: string;
  history: TurnHistoryEntry[];
  studentInput?: string;
  /** True on the very first tick (welcome + setup). */
  isWelcome?: boolean;
}

export function buildAssistantPrompt(args: AssistantPromptArgs): BuiltPrompt {
  const instruction =
    `[ROLE] You are ${args.agent.display_name}, the classroom assistant for Class ${args.classLevel} ${args.subject}. ` +
    `You do NOT teach content and you do NOT answer the problem. You facilitate: welcome the learner, ` +
    `organize turns, manage the whiteboard, and encourage participation. ` +
    `${args.isWelcome === true ? "This is the session start: greet the learner warmly in one sentence and state today's problem in one sentence. " : "Give one brief facilitation move: hand over to the next speaker, set up a whiteboard step, or encourage the learner. "}` +
    `Keep responses to 1-2 sentences. You are speaking aloud. ` +
    utteranceFormatInstruction();
  const lines = [
    "[TEMPLATE:ASSISTANT]",
    instruction,
    "[CONTEXT]",
    `- Display Name: ${args.agent.display_name}`,
    `- Welcome Turn: ${args.isWelcome === true ? "yes" : "no"}`,
  ];
  if (args.studentInput) lines.push(`- Learner Said: """${args.studentInput}"""`);
  lines.push("[HISTORY]", formatHistoryForPrompt(args.history));
  return { instruction, text: lines.join("\n") };
}

/* ---------------- Director: LLM-assisted selection (§4.1) ---------------- */

export interface DirectorPromptArgs {
  registryAgents: { agent_id: string; role: string; speaking_priority: number }[];
  state: DirectorState;
  studentInput?: string;
  studentSilenceSeconds: number;
}

/**
 * Invoked only when no hard turn-taking rule fires. The model proposes the
 * next speaker; the Director validates the choice (known speaker,
 * anti-monologue) and falls back to priority order on any failure.
 */
export function buildDirectorPrompt(args: DirectorPromptArgs): BuiltPrompt {
  const instruction =
    `[ROLE] You are the classroom Director, a meta-agent. You do not teach. ` +
    `Read the conversation state and select the next speaker. ` +
    `[HARD RULES] Never select the same agent twice in a row. ` +
    `Prefer the student after a classmate mistake. Prefer the teacher for checkpoints. ` +
    `Never terminate before the validation phase passes. ` +
    `Output JSON only: {"next_speaker": "<agent_id | student | terminate>", ` +
    `"reason": "<one of: learner_asked_question, teacher_checkpoint_due, ` +
    `classmate_misconception_exposed, discussion_stalled, llm_selected>", ` +
    `"scaffold_level": ${args.state.scaffold_level}, "wait_for_student_seconds": 0}.`;
  const candidates = args.registryAgents
    .map((a) => `${a.agent_id}(${a.role},p${a.speaking_priority})`)
    .join(", ");
  const lines = [
    "[TEMPLATE:DIRECTOR]",
    instruction,
    "[CONTEXT]",
    `- Candidates: ${candidates}`,
    `- Last Speaker: ${args.state.last_speaker_id ?? "none"}`,
    `- Phase: ${args.state.phase} | Scaffold: ${args.state.scaffold_level}`,
    `- Student Silence (s): ${args.studentSilenceSeconds}`,
  ];
  if (args.studentInput) lines.push(`- Learner Said: """${args.studentInput}"""`);
  lines.push("[HISTORY]", formatHistoryForPrompt(args.state.history));
  return { instruction, text: lines.join("\n") };
}

/** Appended to a classmate prompt when the previous draft drifted (§8). */
export const FIDELITY_RETRY_CONSTRAINT =
  `[RETRY] Your previous draft broke character: it stated or implied the correct answer, ` +
  `or sounded like a tutor instead of a peer. Stay inside your belief state. Defend your ` +
  `misconception with flawed reasoning, or show only the scripted partial update.`;
