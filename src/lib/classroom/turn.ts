import { randomUUID } from "node:crypto";
import type { LLMClient } from "../curriculum/llm";
import {
  advanceAfterAgentTurn,
  advanceAfterStudentRouting,
  appendStudentTurn,
  decideNextSpeaker,
  initialDirectorState,
} from "./director";
import { checkPersonaFidelity } from "./fidelity";
import {
  FIDELITY_RETRY_CONSTRAINT,
  buildAssistantPrompt,
  buildClassmatePrompt,
  buildTeacherPrompt,
  type BuiltPrompt,
} from "./personas";
import { questionBriefFor, selectQuestionTrigger } from "./questions";
import { createDefaultClassroom, getAgentById, getTeacher, validateRegistry } from "./registry";
import {
  prosodyForAgent,
  synthesizeSpeechOrFallback,
  type VoiceClient,
} from "./voice";
import {
  AgentUtteranceSchema,
  ClassroomException,
  STUDENT_SPEAKER,
  TERMINATE_SPEAKER,
  type AgentDefinition,
  type AgentUtterance,
  type ClassroomRegistry,
  type ClassroomTurn,
  type ClassroomTurnRequest,
  type ClassroomTurnResponse,
  type DirectorDecision,
  type DirectorState,
  type PersonaFidelity,
} from "./types";

export interface ClassroomDeps {
  llm: LLMClient;
  voice: VoiceClient;
}

/** Fidelity re-generations before a drifted classmate turn is withheld (§8). */
export const MAX_FIDELITY_RETRIES = 2;

/* ------------------------------------------------------------------ */
/* generate_agent_turn: builds the role-specific prompt and generates   */
/* one structured utterance. Stateless — full history rides along.      */
/* ------------------------------------------------------------------ */

export interface AgentTurnContext {
  registry: ClassroomRegistry;
  state: DirectorState;
  agent: AgentDefinition;
  decision: DirectorDecision;
  adaptation: ClassroomTurnRequest["adaptation"];
  studentInput?: string;
  studentAnswerCorrect: boolean | null;
  learnerAddressedConcept: boolean;
  topic?: { title: string; keywords: string[]; summary: string };
}

function buildAgentPrompt(context: AgentTurnContext, retryNote?: string): BuiltPrompt {
  const { registry, state, agent, adaptation } = context;
  const classLevel = registry.class_level;
  let prompt: BuiltPrompt;
  if (agent.role === "teacher") {
    prompt = buildTeacherPrompt({
      agent,
      signals: {
        learner_emotion: adaptation.learner_emotion,
        learner_comprehension: adaptation.learner_comprehension,
        last_checkpoint: state.last_checkpoint,
      },
      classLevel,
      subject: registry.subject,
      localContext: registry.local_context,
      history: state.history,
      studentInput: context.studentInput,
      taskSchema: registry.task_schema,
      isCheckpoint: context.decision.reason === "teacher_checkpoint_due",
      topic: context.topic,
    });
  } else if (agent.role === "assistant") {
    prompt = buildAssistantPrompt({
      agent,
      classLevel,
      subject: registry.subject,
      history: state.history,
      studentInput: context.studentInput,
      isWelcome: context.decision.reason === "session_start",
    });
  } else {
    const personaState = agent.persona_state;
    if (!personaState) {
      throw new ClassroomException(
        "CLASSMATE_PERSONA_MISSING",
        registry.classroom_id,
        400,
        `Classmate "${agent.agent_id}" has no persona_state`,
      );
    }
    const trigger = selectQuestionTrigger({
      history: state.history,
      studentAnswerCorrect: context.studentAnswerCorrect,
    });
    prompt = buildClassmatePrompt({
      agent,
      personaState,
      taskSchema: registry.task_schema,
      classLevel,
      history: state.history,
      studentInput: context.studentInput,
      learnerAddressedConcept: context.learnerAddressedConcept,
      questionBrief: trigger ? questionBriefFor(trigger, registry.task_schema) : undefined,
      topic: context.topic,
    });
  }
  if (retryNote) {
    return { instruction: prompt.instruction, text: `${prompt.text}\n${retryNote}` };
  }
  return prompt;
}

async function generateUtterance(
  context: AgentTurnContext,
  llm: LLMClient,
  retryNote?: string,
): Promise<AgentUtterance> {
  const prompt = buildAgentPrompt(context, retryNote);
  const utterance = await llm.generateJSON(prompt.text, AgentUtteranceSchema);
  // Capability repair: only whiteboard-enabled agents may emit board actions.
  if (utterance.whiteboard_actions.length > 0 && !context.agent.can_draw_whiteboard) {
    return { ...utterance, whiteboard_actions: [] };
  }
  return utterance;
}

/* ------------------------------------------------------------------ */
/* Full per-turn pipeline (§8 tool sequence):                          */
/*   director_decide_next_speaker → generate_agent_turn →               */
/*   check_persona_fidelity (≤2 retries) → synthesize_speech            */
/* ------------------------------------------------------------------ */

export async function runClassroomTurn(
  request: ClassroomTurnRequest,
  deps: ClassroomDeps,
): Promise<ClassroomTurnResponse> {
  const registry = request.registry ?? createDefaultClassroom();
  const issues = validateRegistry(registry);
  if (issues.length > 0) {
    throw new ClassroomException("REGISTRY_INVALID", registry.classroom_id, 400, issues.join("; "));
  }

  let state: DirectorState = request.state ?? initialDirectorState();
  if (request.student_input !== undefined && request.student_input.trim().length > 0) {
    state = appendStudentTurn(state, request.student_input);
  }
  // Checkpoint outcome follows the learner's latest answer when known.
  if (request.student_answer_correct !== null) {
    state = {
      ...state,
      last_checkpoint: request.student_answer_correct ? "passed" : "failed",
      validation_passed:
        state.phase === "validation" && request.student_answer_correct
          ? true
          : state.validation_passed,
    };
  }

  let decision = await decideNextSpeaker(
    {
      registry,
      state,
      studentInput: request.student_input,
      studentSilenceSeconds: request.student_silence_seconds,
    },
    deps.llm,
  );

  if (decision.next_speaker === STUDENT_SPEAKER || decision.next_speaker === TERMINATE_SPEAKER) {
    return {
      classroom_id: registry.classroom_id,
      decision,
      turn: null,
      state: advanceAfterStudentRouting(state, decision),
      registry,
    };
  }

  let agent = getAgentById(registry, decision.next_speaker);
  if (!agent) {
    throw new ClassroomException(
      "DIRECTOR_UNKNOWN_SPEAKER",
      registry.classroom_id,
      500,
      `Director selected unknown speaker "${decision.next_speaker}"`,
    );
  }

  const baseContext: AgentTurnContext = {
    registry,
    state,
    agent,
    decision,
    adaptation: request.adaptation,
    studentInput: request.student_input,
    studentAnswerCorrect: request.student_answer_correct,
    learnerAddressedConcept: request.learner_addressed_concept,
    topic: request.topic,
  };

  // Classmates pass the fidelity guardrail; after two drifted drafts the
  // turn is withheld and the teacher gives a neutral redirect (§8).
  let utterance = await generateUtterance(baseContext, deps.llm);
  let fidelity: PersonaFidelity = { belief_state_preserved: true, drift_detected: false };
  const personaState = agent.role === "classmate" ? agent.persona_state : undefined;
  if (personaState) {
    fidelity = checkPersonaFidelity({
      utteranceText: utterance.text,
      personaState,
      taskSchema: registry.task_schema,
      learnerAddressedConcept: request.learner_addressed_concept,
    });
    let retries = 0;
    while (fidelity.drift_detected && retries < MAX_FIDELITY_RETRIES) {
      retries += 1;
      utterance = await generateUtterance(baseContext, deps.llm, FIDELITY_RETRY_CONSTRAINT);
      fidelity = checkPersonaFidelity({
        utteranceText: utterance.text,
        personaState,
        taskSchema: registry.task_schema,
        learnerAddressedConcept: request.learner_addressed_concept,
      });
    }
    if (fidelity.drift_detected) {
      agent = getTeacher(registry);
      const redirectPrompt = buildTeacherPrompt({
        agent,
        signals: {
          learner_emotion: request.adaptation.learner_emotion,
          learner_comprehension: request.adaptation.learner_comprehension,
          last_checkpoint: state.last_checkpoint,
        },
        classLevel: registry.class_level,
        subject: registry.subject,
        localContext: registry.local_context,
        history: state.history,
        studentInput: request.student_input,
        taskSchema: registry.task_schema,
        redirectAfterDrift: true,
      });
      const redirect = await deps.llm.generateJSON(redirectPrompt.text, AgentUtteranceSchema);
      utterance = { ...redirect, move_type: "redirect" as const, misconception_id: null };
      fidelity = {
        belief_state_preserved: true,
        drift_detected: false,
        detail: "classmate turn withheld after repeated drift; teacher redirect delivered",
      };
      decision = { ...decision, next_speaker: agent.agent_id, reason: "teacher_redirect_after_drift" };
    }
  }

  const speech = await synthesizeSpeechOrFallback(deps.voice, {
    text: utterance.text,
    voice_id: agent.voice_id,
    prosody: prosodyForAgent(agent),
  });

  const turn: ClassroomTurn = {
    turn_id: randomUUID(),
    speaker: { agent_id: agent.agent_id, display_name: agent.display_name, role: agent.role },
    content: { text: utterance.text, speech_audio_url: speech.audio_url, duration_ms: speech.duration_ms },
    pedagogical_annotation: {
      move_type: utterance.move_type,
      misconception_id: utterance.misconception_id,
      invites_student_response: utterance.invites_student_response,
    },
    persona_fidelity: fidelity,
    whiteboard_actions: utterance.whiteboard_actions,
    mode: speech.mode,
  };

  state = advanceAfterAgentTurn(state, decision, turn);
  // Text fallback is sticky: once TTS fails, the session stays text-first.
  if (speech.mode === "text_fallback") state = { ...state, mode: "text_fallback" };

  return { classroom_id: registry.classroom_id, decision, turn, state, registry };
}
