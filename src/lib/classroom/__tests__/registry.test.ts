import { describe, expect, it } from "vitest";
import { createDefaultClassroom, validateRegistry, voiceIdIssues } from "../registry";
import { ClassroomRegistrySchema } from "../types";

function validRegistry() {
  return ClassroomRegistrySchema.parse(createDefaultClassroom("test_room"));
}

describe("agent registry (§2)", () => {
  it("ships a valid default 1 Teacher + 1 Assistant + 4 Classmates composition", () => {
    const registry = validRegistry();
    expect(validateRegistry(registry)).toEqual([]);
    const roles = registry.agents.map((a) => a.role).sort();
    expect(roles).toEqual(["assistant", "classmate", "classmate", "classmate", "classmate", "teacher"]);
  });

  it("gives every default agent a distinct personality and voice", () => {
    const registry = validRegistry();
    const names = registry.agents.map((a) => a.display_name);
    const voices = registry.agents.map((a) => a.voice_id);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(voices).size).toBe(voices.length);
    const biases = registry.agents
      .filter((a) => a.role === "classmate")
      .map((a) => a.persona_traits.misconception_bias?.join("+"));
    expect(new Set(biases).size).toBe(4);
    for (const agent of registry.agents.filter((a) => a.role === "classmate")) {
      expect(agent.can_make_mistakes).toBe(true);
      expect(agent.persona_state?.misconception_statement.length).toBeGreaterThan(0);
    }
  });

  it("rejects registries without exactly one teacher", () => {
    const registry = validRegistry();
    const twoTeachers = {
      ...registry,
      agents: registry.agents.map((a) =>
        a.agent_id === "assistant_01" ? { ...a, role: "teacher" as const } : a,
      ),
    };
    expect(validateRegistry(twoTeachers).join("; ")).toContain("exactly one teacher");
  });

  it("rejects registries with no fallible classmate", () => {
    const registry = validRegistry();
    const noFallible = {
      ...registry,
      agents: registry.agents.map((a) => ({ ...a, can_make_mistakes: false })),
    };
    expect(validateRegistry(noFallible).join("; ")).toContain("can_make_mistakes");
  });

  it("requires the teacher to outrank every other agent", () => {
    const registry = validRegistry();
    const rival = {
      ...registry,
      agents: registry.agents.map((a) =>
        a.agent_id === "classmate_curious" ? { ...a, speaking_priority: 10 } : a,
      ),
    };
    expect(validateRegistry(rival).join("; ")).toContain("must outrank");
  });

  it("requires fallible classmates to define a persona state", () => {
    const registry = validRegistry();
    const missing = {
      ...registry,
      agents: registry.agents.map((a) =>
        a.agent_id === "classmate_curious" ? { ...a, persona_state: undefined } : a,
      ),
    };
    expect(validateRegistry(missing).join("; ")).toContain("persona_state");
  });

  it("rejects duplicate agent ids and unsupported voice providers", () => {
    const registry = validRegistry();
    const duped = {
      ...registry,
      agents: [...registry.agents, { ...registry.agents[0]! }],
    };
    expect(validateRegistry(duped).join("; ")).toContain("duplicate agent_id");
    expect(voiceIdIssues("acme_teacher_female_in").join("; ")).toContain("unsupported provider");
    expect(voiceIdIssues("voxcpm2_broken").join("; ")).toContain("must match");
    expect(voiceIdIssues("mock_peer_child_in")).toEqual([]);
  });
});
