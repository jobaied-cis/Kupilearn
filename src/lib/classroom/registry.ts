import {
  type AgentDefinition,
  type AgentRole,
  type ClassroomRegistry,
} from "./types";

/* ------------------------------------------------------------------ */
/* Registry rules (§2): structural invariants checked on every turn.    */
/* ------------------------------------------------------------------ */

/** Providers the voice layer can resolve a voice_id against (§2, §5.2). */
export const SUPPORTED_VOICE_PROVIDERS = ["mock", "voxcpm2"] as const;

/**
 * voice_id grammar: `<provider>_<persona>_<gender>_<locale>`, e.g.
 * `voxcpm2_teacher_female_in`. The mock provider accepts any suffix so
 * tests and zero-infra demos need no voice assets.
 */
export function voiceIdIssues(voiceId: string): string[] {
  const [provider, ...rest] = voiceId.split("_");
  if (!provider || !(SUPPORTED_VOICE_PROVIDERS as readonly string[]).includes(provider)) {
    return [`voice_id "${voiceId}" has an unsupported provider (want one of: ${SUPPORTED_VOICE_PROVIDERS.join(", ")})`];
  }
  if (rest.length < 3 || rest.some((segment) => segment.length === 0)) {
    return [`voice_id "${voiceId}" must match <provider>_<persona>_<gender>_<locale>`];
  }
  return [];
}

/**
 * Returns one human-readable issue per violated registry rule, [] when
 * valid. Run after zod parsing; the turn pipeline throws REGISTRY_INVALID
 * with these joined when non-empty.
 */
export function validateRegistry(registry: ClassroomRegistry): string[] {
  const issues: string[] = [];
  const { agents } = registry;

  const teachers = agents.filter((a) => a.role === "teacher");
  if (teachers.length !== 1) {
    issues.push(`registry must define exactly one teacher agent, found ${teachers.length}`);
  }
  if (agents.filter((a) => a.role === "classmate" && a.can_make_mistakes).length < 1) {
    issues.push("registry must define at least one classmate with can_make_mistakes: true");
  }

  const teacher = teachers[0];
  if (teacher) {
    const outranked = agents.filter(
      (a) => a.agent_id !== teacher.agent_id && a.speaking_priority >= teacher.speaking_priority,
    );
    for (const other of outranked) {
      issues.push(
        `teacher "${teacher.agent_id}" (priority ${teacher.speaking_priority}) must outrank ` +
          `"${other.agent_id}" (priority ${other.speaking_priority})`,
      );
    }
  }

  const seen = new Set<string>();
  for (const agent of agents) {
    if (seen.has(agent.agent_id)) issues.push(`duplicate agent_id "${agent.agent_id}"`);
    seen.add(agent.agent_id);
    issues.push(...voiceIdIssues(agent.voice_id).map((issue) => `${agent.agent_id}: ${issue}`));
    if (agent.role === "classmate" && agent.can_make_mistakes && !agent.persona_state) {
      issues.push(
        `fallible classmate "${agent.agent_id}" must define persona_state (misconception + reasoning pattern)`,
      );
    }
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Registry accessors                                                  */
/* ------------------------------------------------------------------ */

export function getTeacher(registry: ClassroomRegistry): AgentDefinition {
  const teacher = registry.agents.find((a) => a.role === "teacher");
  if (!teacher) throw new Error("Registry has no teacher agent (validateRegistry should have rejected it)");
  return teacher;
}

export function getAgentById(registry: ClassroomRegistry, agentId: string): AgentDefinition | null {
  return registry.agents.find((a) => a.agent_id === agentId) ?? null;
}

export function agentsByRole(registry: ClassroomRegistry, role: AgentRole): AgentDefinition[] {
  return registry.agents.filter((a) => a.role === role);
}

/** Fallback speaking order: priority desc, then agent_id asc (stable). */
export function orderByPriorityFallback(registry: ClassroomRegistry): AgentDefinition[] {
  return [...registry.agents].sort(
    (a, b) => b.speaking_priority - a.speaking_priority || a.agent_id.localeCompare(b.agent_id),
  );
}

/* ------------------------------------------------------------------ */
/* Default composition (§1.1): 1 Teacher + 1 Assistant + 4 Classmates,  */
/* each with a distinct personality and voice.                         */
/* ------------------------------------------------------------------ */

export function createDefaultClassroom(classroomId = "classroom_default"): ClassroomRegistry {
  return {
    classroom_id: classroomId,
    subject: "Mathematics",
    class_level: 8,
    local_context: "Indian daily life",
    task_schema: {
      problem_statement: "Solve for x: 3x − 7 = 20.",
      solution_path: [
        "Add 7 to both sides: 3x = 27.",
        "Divide both sides by 3: x = 9.",
        "Verify: 3 × 9 − 7 = 20.",
      ],
      correct_answer: "x = 9",
      key_terms: ["equation", "variable", "transposing", "verify"],
    },
    agents: [
      {
        agent_id: "teacher_01",
        role: "teacher",
        display_name: "Ms. Meera",
        persona_traits: {
          warmth: 0.85,
          pace: "moderate",
          explanation_style: "socratic",
          humor: 0.2,
        },
        voice_id: "voxcpm2_teacher_female_in",
        expertise: ["mathematics", "class_8"],
        speaking_priority: 10,
        can_draw_whiteboard: true,
        can_make_mistakes: false,
      },
      {
        agent_id: "assistant_01",
        role: "assistant",
        display_name: "Kabir",
        persona_traits: { warmth: 0.7, pace: "moderate", humor: 0.35 },
        voice_id: "voxcpm2_host_male_in",
        expertise: ["facilitation", "whiteboard"],
        speaking_priority: 7,
        can_draw_whiteboard: true,
        can_make_mistakes: false,
      },
      {
        agent_id: "classmate_curious",
        role: "classmate",
        display_name: "Aarav",
        persona_traits: {
          proficiency: 0.55,
          curiosity: 0.95,
          confidence: 0.4,
          misconception_bias: ["overgeneralization"],
        },
        voice_id: "voxcpm2_child_male_in",
        expertise: [],
        speaking_priority: 5,
        can_draw_whiteboard: false,
        can_make_mistakes: true,
        persona_state: {
          misconception_id: "transpose_sign_ignored",
          misconception_statement: "Moving −7 to the other side keeps it as −7, so 3x = 20 − 7 = 13.",
          confidence: 0.4,
          reasoning_pattern: "I move numbers across the equals sign without changing their sign.",
          partial_update_statement:
            "Oh — so the balance tips unless I undo −7 with +7 on both sides?",
        },
      },
      {
        agent_id: "classmate_critical",
        role: "classmate",
        display_name: "Zoya",
        persona_traits: {
          proficiency: 0.75,
          curiosity: 0.6,
          confidence: 0.8,
          misconception_bias: ["surface_analogy"],
        },
        voice_id: "voxcpm2_child_female_in",
        expertise: [],
        speaking_priority: 5,
        can_draw_whiteboard: false,
        can_make_mistakes: true,
        persona_state: {
          misconception_id: "divide_one_side_only",
          misconception_statement: "3x = 27 means x = 27, because the 3 just disappears when x is alone.",
          confidence: 0.8,
          reasoning_pattern: "I drop the coefficient instead of dividing both sides by it.",
          partial_update_statement:
            "Hmm, so 3x means 3 times x, and I have to undo that on both sides?",
        },
      },
      {
        agent_id: "classmate_methodical",
        role: "classmate",
        display_name: "Ishaan",
        persona_traits: {
          proficiency: 0.65,
          curiosity: 0.5,
          confidence: 0.6,
          misconception_bias: ["procedural_rigidity"],
        },
        voice_id: "voxcpm2_teen_male_in",
        expertise: [],
        speaking_priority: 4,
        can_draw_whiteboard: false,
        can_make_mistakes: true,
        persona_state: {
          misconception_id: "verify_by_resubstitution_skipped",
          misconception_statement: "Once x looks neat, the answer is done — checking it back is a waste of time.",
          confidence: 0.6,
          reasoning_pattern: "I stop at the first neat-looking value and never verify it.",
          partial_update_statement:
            "Putting x back in actually caught my arithmetic slip — I will check every time now.",
        },
      },
      {
        agent_id: "classmate_playful",
        role: "classmate",
        display_name: "Myra",
        persona_traits: {
          proficiency: 0.5,
          curiosity: 0.85,
          confidence: 0.5,
          misconception_bias: ["intuitive_leap"],
        },
        voice_id: "voxcpm2_teen_female_in",
        expertise: [],
        speaking_priority: 4,
        can_draw_whiteboard: false,
        can_make_mistakes: true,
        persona_state: {
          misconception_id: "equals_means_write_answer",
          misconception_statement: "The equals sign just means write the answer next, so 3x − 7 = 20 means the answer is 20 − 7 = 13.",
          confidence: 0.5,
          reasoning_pattern: "I read = as 'write the answer' instead of 'both sides balance'.",
          partial_update_statement:
            "So = is a balance, not an instruction — both sides have to stay equal?",
        },
      },
    ],
  };
}
