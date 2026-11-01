import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST as answerPOST } from "../../app/api/games/sessions/[sessionId]/answer/route";
import { POST as sessionsPOST } from "../../app/api/games/sessions/route";
import { MAX_JSON_BODY_BYTES, parseJsonBody } from "./http";
import { activeSessionCount, MAX_GAME_SESSIONS, startMissionSession, submitMissionAnswer } from "./server";

const post = (url: string, body: string) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body });
const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

describe("Step 06 security hardening", () => {
  it("rejects oversized and malformed JSON bodies before game logic", async () => {
    const huge = JSON.stringify({ challengeId: "pq1-seq", answer: "x".repeat(MAX_JSON_BODY_BYTES + 1) });
    await expect(parseJsonBody(post("http://localhost/x", huge))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    await expect(parseJsonBody(post("http://localhost/x", "{not json"))).rejects.toMatchObject({ code: "INVALID_JSON" });

    const { sessionId } = startMissionSession("pq-c6-math-first-steps", "security-test");
    const res = await answerPOST(post("http://localhost/x", huge), params(sessionId));
    expect(res.status).toBe(413);
    const bad = await sessionsPOST(post("http://localhost/x", "{broken"));
    expect(bad.status).toBe(400);
  });

  it("bounds in-memory sessions and prunes the oldest (results stores unaffected)", () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(startMissionSession("pq-c6-math-first-steps", "prune-test").sessionId);
    const total = MAX_GAME_SESSIONS + 3;
    for (let i = ids.length; i < total; i++) startMissionSession("pq-c6-math-first-steps", "prune-test");
    expect(activeSessionCount()).toBeLessThanOrEqual(MAX_GAME_SESSIONS);
    // The very first session was pruned; using it is a clean 404-style error.
    expect(() => submitMissionAnswer(ids[0]!, "pq1-seq", 11)).toThrowError(/Unknown session/);
  });

  it("committed env example contains placeholders only, never a real-looking key", () => {
    const envExample = readFileSync(".env.example", "utf8");
    expect(envExample).toMatch(/^META_API_KEY=(your_[a-z_]+)?\s*$/m);
    expect(envExample).not.toMatch(/META_API_KEY=(?!your_)\S{16,}/);
    expect(envExample).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });

  it("no game API payload exposes secrets or answer keys", async () => {
    const { GET } = await import("../../app/api/games/missions/route");
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("META_API_KEY");
    expect(text).not.toContain("answerKey");
    expect(text).not.toMatch(/api[_-]?key/i);
  });
});
