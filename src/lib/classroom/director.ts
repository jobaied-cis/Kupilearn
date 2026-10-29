import { randomUUID } from "node:crypto";
import type { LLMClient } from "../curriculum/llm";
import { buildDirectorPrompt } from "./personas";
import { agentsByRole, getAgentById, orderByPriorityFallback } from "./registry";
import {
  DirectorDecisionSchema,
  STUDENT_SPEAKER,
  TERMINATE_SPEAKER,
  type AgentDefinition,
  type ClassroomRegistry,
  type ClassroomTurn,
  type DirectorDecision,
  type DirectorReason,
  type DirectorState,
  type MoveType,
  type PedagogicalPhase,
} from "./types";

/* ------------------------------------------------------------------ */
/* Director agent (§4): the meta-agent. It does not teach — it reads    */
/* conversation state, the registry, and the learner's last input,     */
/* then selects the next speaker. Hard rules always win; the LLM is     */
/* consulted only when no rule fires, and priority order is the final   */
/* fallback.                                                           */
/* ------------------------------------------------------------------ */

export const CHECKPOINT_CADENCE = 3;
export const STRATEGIC_DELAY_SILENCE_S = 10;
export const TEXT_MODE_DELAY_SILENCE_S = 20;
export const STUDENT_WAIT_S = 10;
export const YIELD_WAIT_S = 20;
/** Scaffold fades 1.0 → 0.0 across this many ticks (§4.2 scaffold fade). */
export const FADE_HORIZON_TURNS = 20;
/** Bounded speaking-history window echoed through stateless clients. */
export const HISTORY_WINDOW = 40;

const PHASE_ORDER: PedagogicalPhase[] = [
  "shared_understanding",
  "team_organization",
  "planning",
  "execution",
  "validation",
];

/** Classmate moves that expose an error the learner should diagnose first. */
const ERROR_EXPOSING_MOVES: MoveType[] = ["misconception_exposure", "related_mistake"];

export function initialDirectorState(): DirectorState {
  return {
    phase: "shared_understanding",
    scaffold_level: 1,
    turn_count: 0,
    classmate_utterances_since_checkpoint: 0,
    consecutive_teacher_turns: 0,
    last_speaker_id: null,
    last_move_type: null,
    pending_student_yield: false,
    text_mode_skips: 0,
    last_checkpoint: "not_attempted",
    validation_passed: false,
    mode: "voice",
    history: [],
  };
}

export function scaffoldForTurnCount(turnCount: number): number {
  return Math.round(Math.max(0, 1 - turnCount / FADE_HORIZON_TURNS) * 100) / 100;
}

export function trimHistory<T>(history: T[]): T[] {
  return history.slice(-HISTORY_WINDOW);
}

/* ------------------------------------------------------------------ */
/* Mandatory turn-taking rules (§4.2), evaluated in precedence order.   */
/* Pure: no I/O, fully deterministic.                                  */
/* ------------------------------------------------------------------ */

export interface DirectorRuleInput {
  registry: ClassroomRegistry;
  state: DirectorState;
  studentInput?: string;
  studentSilenceSeconds: number;
}

export type RuleOutcome =
  | { kind: "decided"; decision: DirectorDecision }
  | { kind: "uncertain" };

function decide(
  state: DirectorState,
  nextSpeaker: string,
  reason: DirectorReason,
  waitForStudentSeconds = 0,
): DirectorDecision {
  return {
    next_speaker: nextSpeaker,
    reason,
    scaffold_level: state.scaffold_level,
    wait_for_student_seconds: waitForStudentSeconds,
  };
}

function highestPriorityExcept(
  registry: ClassroomRegistry,
  excludeId: string | null,
): AgentDefinition | null {
  return orderByPriorityFallback(registry).find((a) => a.agent_id !== excludeId) ?? null;
}

function thinkAloudClassmate(
  registry: ClassroomRegistry,
  excludeId: string | null,
): AgentDefinition | null {
  const classmates = orderByPriorityFallback(registry).filter(
    (a) => a.role === "classmate" && a.agent_id !== excludeId,
  );
  return classmates[0] ?? null;
}

function isStudentQuestion(input: string | undefined): boolean {
  return input !== undefined && input.trim().endsWith("?");
}

export function applyDirectorRules(input: DirectorRuleInput): RuleOutcome {
  const { registry, state } = input;

  // Terminal: validation passed — the session is complete. Checked first
  // so a finished session ends even on a degenerate (empty-history) state.
  if (state.phase === "validation" && state.validation_passed) {
    return {
      kind: "decided",
      decision: decide(state, TERMINATE_SPEAKER, "session_complete"),
    };
  }

  // Session start: the assistant welcomes and frames the problem.
  // Fires while no agent has spoken yet, even if the learner jumped in first.
  if (!state.history.some((h) => h.role !== "student")) {
    const assistant = agentsByRole(registry, "assistant")[0];
    const speaker = assistant ?? highestPriorityExcept(registry, null);
    if (speaker) return { kind: "decided", decision: decide(state, speaker.agent_id, "session_start") };
    return { kind: "uncertain" };
  }

  // Yield back to the student after a strategic-delay interjection.
  if (state.pending_student_yield) {
    return {
      kind: "decided",
      decision: decide(state, STUDENT_SPEAKER, "strategic_delay_yield", YIELD_WAIT_S),
    };
  }

  const lastRole = state.history[state.history.length - 1]?.role ?? null;

  // Student priority after a classmate error: the learner diagnoses first.
  if (
    lastRole === "classmate" &&
    state.last_move_type !== null &&
    ERROR_EXPOSING_MOVES.includes(state.last_move_type)
  ) {
    return {
      kind: "decided",
      decision: decide(state, STUDENT_SPEAKER, "student_priority_after_error", YIELD_WAIT_S),
    };
  }

  // The learner asked a question — the teacher answers.
  if (lastRole === "student" && isStudentQuestion(input.studentInput)) {
    const teacher = agentsByRole(registry, "teacher")[0];
    if (teacher) {
      return { kind: "decided", decision: decide(state, teacher.agent_id, "learner_asked_question") };
    }
  }

  // Teacher checkpoint cadence — unless the student is mid-explanation.
  if (state.classmate_utterances_since_checkpoint >= CHECKPOINT_CADENCE && lastRole !== "student") {
    const teacher = agentsByRole(registry, "teacher")[0];
    if (teacher) {
      return { kind: "decided", decision: decide(state, teacher.agent_id, "teacher_checkpoint_due") };
    }
  }

  // Strategic delay: prolonged silence earns a classmate "thinking aloud"
  // prompt, then a yield back to the student. Text mode throttles these
  // interjections (every other one waits for the student instead).
  const silenceThreshold =
    state.mode === "text_fallback" ? TEXT_MODE_DELAY_SILENCE_S : STRATEGIC_DELAY_SILENCE_S;
  if (input.studentSilenceSeconds > silenceThreshold) {
    const skipInTextMode = state.mode === "text_fallback" && state.text_mode_skips % 2 === 1;
    const classmate = thinkAloudClassmate(registry, state.last_speaker_id);
    if (!skipInTextMode && classmate) {
      return { kind: "decided", decision: decide(state, classmate.agent_id, "discussion_stalled") };
    }
    return {
      kind: "decided",
      decision: decide(state, STUDENT_SPEAKER, "discussion_stalled", YIELD_WAIT_S),
    };
  }

  // Phase entry: the assistant organizes the team once per session.
  if (state.phase === "team_organization") {
    const assistant = agentsByRole(registry, "assistant")[0];
    const assistantTurns = state.history.filter((h) => h.role === "assistant").length;
    if (assistant && assistantTurns < 2 && state.last_speaker_id !== assistant.agent_id) {
      return { kind: "decided", decision: decide(state, assistant.agent_id, "phase_transition") };
    }
  }

  // Scaffold fade: at 0.0 the Director routes to peers over the teacher.
  if (state.scaffold_level <= 0 && lastRole !== "classmate") {
    const classmate = thinkAloudClassmate(registry, state.last_speaker_id);
    if (classmate) {
      return {
        kind: "decided",
        decision: decide(state, classmate.agent_id, "scaffold_fade_peer_routing"),
      };
    }
  }

  return { kind: "uncertain" };
}

/* ------------------------------------------------------------------ */
/* Anti-monologue (§4.2): no agent speaks twice consecutively, except   */
/* the teacher during direct instruction (max 2 consecutive turns).    */
/* ------------------------------------------------------------------ */

function isAgentSpeaker(registry: ClassroomRegistry, speaker: string): boolean {
  return getAgentById(registry, speaker) !== null;
}

/**
 * Repairs a candidate speaker that would violate anti-monologue by
 * rerouting to the highest-priority other agent. Returns null only when
 * no agent at all can speak (degenerate single-agent registry).
 */
export function repairMonologueViolation(
  registry: ClassroomRegistry,
  state: DirectorState,
  candidate: string,
): DirectorDecision | null {
  if (candidate !== state.last_speaker_id) return null;
  const agent = getAgentById(registry, candidate);
  const directInstruction = state.phase === "shared_understanding";
  if (agent?.role === "teacher" && directInstruction && state.consecutive_teacher_turns < 2) {
    return null; // Allowed: teacher direct-instruction double.
  }
  const replacement = highestPriorityExcept(registry, state.last_speaker_id);
  if (!replacement) return decide(state, STUDENT_SPEAKER, "priority_fallback", STUDENT_WAIT_S);
  return decide(state, replacement.agent_id, "priority_fallback");
}

function priorityFallbackDecision(registry: ClassroomRegistry, state: DirectorState): DirectorDecision {
  const replacement = highestPriorityExcept(registry, state.last_speaker_id);
  if (!replacement) return decide(state, STUDENT_SPEAKER, "priority_fallback", STUDENT_WAIT_S);
  return decide(state, replacement.agent_id, "priority_fallback");
}

/* ------------------------------------------------------------------ */
/* Full decision: hard rules → LLM selection → priority fallback.      */
/* The Director owns scaffold_level — the LLM never sets it.           */
/* ------------------------------------------------------------------ */

export async function decideNextSpeaker(
  input: DirectorRuleInput,
  llm: LLMClient,
): Promise<DirectorDecision> {
  const { registry, state } = input;

  const ruled = applyDirectorRules(input);
  if (ruled.kind === "decided") {
    if (isAgentSpeaker(registry, ruled.decision.next_speaker)) {
      return (
        repairMonologueViolation(registry, state, ruled.decision.next_speaker) ?? ruled.decision
      );
    }
    return ruled.decision;
  }

  try {
    const { text } = buildDirectorPrompt({
      registryAgents: registry.agents.map((a) => ({
        agent_id: a.agent_id,
        role: a.role,
        speaking_priority: a.speaking_priority,
      })),
      state,
      studentInput: input.studentInput,
      studentSilenceSeconds: input.studentSilenceSeconds,
    });
    const proposed = await llm.generateJSON(text, DirectorDecisionSchema);
    const speaker = proposed.next_speaker;
    const known =
      speaker === STUDENT_SPEAKER ||
      speaker === TERMINATE_SPEAKER ||
      isAgentSpeaker(registry, speaker);
    if (!known) return priorityFallbackDecision(registry, state);
    // Hard guard: never terminate before validation passes.
    if (speaker === TERMINATE_SPEAKER && !(state.phase === "validation" && state.validation_passed)) {
      return priorityFallbackDecision(registry, state);
    }
    if (isAgentSpeaker(registry, speaker)) {
      const repaired = repairMonologueViolation(registry, state, speaker);
      if (repaired) return repaired;
    }
    return {
      next_speaker: speaker,
      reason: proposed.reason === "session_complete" ? "llm_selected" : proposed.reason,
      scaffold_level: state.scaffold_level,
      wait_for_student_seconds: Math.max(0, Math.min(60, proposed.wait_for_student_seconds)),
    };
  } catch {
    return priorityFallbackDecision(registry, state);
  }
}

/* ------------------------------------------------------------------ */
/* Pedagogical phase machine (§4.3): five-stage CPS framework.          */
/* Transitions are monotonic — phases never regress.                   */
/*                                                                     */
/*   shared_understanding → team_organization → planning → execution    */
/*   → validation                                                      */
/* ------------------------------------------------------------------ */

function countRole(history: DirectorState["history"], role: string): number {
  return history.filter((h) => h.role === role).length;
}

function countMove(history: DirectorState["history"], move: MoveType): number {
  return history.filter((h) => h.move_type === move).length;
}

function reachablePhaseIndex(history: DirectorState["history"]): number {
  let index = 0;
  // shared_understanding → team_organization: the teacher has framed the problem.
  if (index === 0 && countRole(history, "teacher") >= 2) index = 1;
  // team_organization → planning: welcome + team-setup facilitation done.
  if (index === 1 && countRole(history, "assistant") >= 2) index = 2;
  // planning → execution: peers have engaged with the plan.
  if (index === 2 && countRole(history, "classmate") >= 2) index = 3;
  // execution → validation: a checkpoint ran and the learner participated.
  if (index === 3 && countMove(history, "checkpoint") >= 1 && countRole(history, "student") >= 2) {
    index = 4;
  }
  return index;
}

export function computePhase(current: PedagogicalPhase, history: DirectorState["history"]): PedagogicalPhase {
  const next = Math.max(PHASE_ORDER.indexOf(current), reachablePhaseIndex(history));
  return PHASE_ORDER[next] ?? current;
}

/* ------------------------------------------------------------------ */
/* State transitions. Student input is recorded before the Director     */
/* decides; agent turns are recorded after generation.                 */
/* ------------------------------------------------------------------ */

export function appendStudentTurn(state: DirectorState, studentInput: string): DirectorState {
  const turnCount = state.turn_count + 1;
  return {
    ...state,
    turn_count: turnCount,
    scaffold_level: scaffoldForTurnCount(turnCount),
    consecutive_teacher_turns: 0,
    last_speaker_id: STUDENT_SPEAKER,
    last_move_type: "student_response",
    pending_student_yield: false,
    history: trimHistory([
      ...state.history,
      {
        turn_id: `student-${randomUUID()}`,
        speaker_id: STUDENT_SPEAKER,
        role: "student" as const,
        move_type: "student_response" as const,
        text_preview: studentInput.slice(0, 280),
      },
    ]),
  };
}

export function advanceAfterAgentTurn(
  state: DirectorState,
  decision: DirectorDecision,
  turn: ClassroomTurn,
): DirectorState {
  const turnCount = state.turn_count + 1;
  const role = turn.speaker.role;
  const history = trimHistory([
    ...state.history,
    {
      turn_id: turn.turn_id,
      speaker_id: turn.speaker.agent_id,
      role,
      move_type: turn.pedagogical_annotation.move_type,
      text_preview: turn.content.text.slice(0, 280),
    },
  ]);
  const isCheckpoint = role === "teacher" && turn.pedagogical_annotation.move_type === "checkpoint";
  return {
    ...state,
    phase: computePhase(state.phase, history),
    scaffold_level: scaffoldForTurnCount(turnCount),
    turn_count: turnCount,
    classmate_utterances_since_checkpoint:
      role === "classmate"
        ? state.classmate_utterances_since_checkpoint + 1
        : isCheckpoint
          ? 0
          : state.classmate_utterances_since_checkpoint,
    consecutive_teacher_turns: role === "teacher" ? state.consecutive_teacher_turns + 1 : 0,
    last_speaker_id: turn.speaker.agent_id,
    last_move_type: turn.pedagogical_annotation.move_type,
    pending_student_yield:
      decision.reason === "discussion_stalled" && role === "classmate"
        ? true
        : state.pending_student_yield,
    text_mode_skips:
      decision.reason === "discussion_stalled" ? state.text_mode_skips + 1 : state.text_mode_skips,
    history,
  };
}

/** Ticks the clock when the Director routes to the student or terminates. */
export function advanceAfterStudentRouting(state: DirectorState, decision: DirectorDecision): DirectorState {
  const turnCount = state.turn_count + 1;
  return {
    ...state,
    turn_count: turnCount,
    scaffold_level: scaffoldForTurnCount(turnCount),
    pending_student_yield:
      decision.reason === "strategic_delay_yield" ? true : state.pending_student_yield,
    text_mode_skips:
      decision.reason === "discussion_stalled" ? state.text_mode_skips + 1 : state.text_mode_skips,
  };
}
