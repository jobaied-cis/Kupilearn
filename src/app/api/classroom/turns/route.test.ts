import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/classroom/turns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/classroom/turns", () => {
  it("opens a session with defaults and returns a typed turn", async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      classroom_id: string;
      decision: { next_speaker: string; reason: string };
      turn: { speaker: { agent_id: string }; content: { speech_audio_url: string }; persona_fidelity: object };
      state: { turn_count: number };
    };
    expect(json.classroom_id).toBe("classroom_default");
    expect(json.decision).toMatchObject({ next_speaker: "assistant_01", reason: "session_start" });
    expect(json.turn.speaker.agent_id).toBe("assistant_01");
    expect(json.turn.content.speech_audio_url).toContain("mock://tts/");
    expect(json.state.turn_count).toBe(1);
  });

  it("continues statelessly across echoed states", async () => {
    const first = (await (await post({})).json()) as { state: object };
    const res = await post({ state: first.state, student_input: "Why do we add 7 to both sides?" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      decision: { next_speaker: string; reason: string };
      state: { turn_count: number };
    };
    expect(json.decision).toMatchObject({ next_speaker: "teacher_01", reason: "learner_asked_question" });
    expect(json.state.turn_count).toBe(3);
  });

  it("returns 400 for invalid bodies", async () => {
    const res = await post({ student_silence_seconds: -5 });
    expect(res.status).toBe(400);
    const badJson = await POST(
      new Request("http://localhost/api/classroom/turns", { method: "POST", body: "not-json{" }),
    );
    expect(badJson.status).toBe(400);
  });

  it("returns 400 with REGISTRY_INVALID for rule-breaking registries", async () => {
    const valid = (await (await post({})).json()) as {
      registry: { agents: { agent_id: string; role: string }[] };
    };
    const registry = {
      ...valid.registry,
      agents: valid.registry.agents.map((a) =>
        a.agent_id === "assistant_01" ? { ...a, role: "teacher" } : a,
      ),
    };
    const res = await post({ registry });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; detail: string };
    expect(json.error).toBe("REGISTRY_INVALID");
    expect(json.detail).toContain("exactly one teacher");
  });
});
