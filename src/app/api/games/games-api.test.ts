import { describe, expect, it } from "vitest";
import { GET as missionsGET } from "./missions/route";
import { POST as sessionsPOST } from "./sessions/route";
import { POST as answerPOST } from "./sessions/[sessionId]/answer/route";
import { POST as hintPOST } from "./sessions/[sessionId]/hint/route";

const post = (url: string, body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

describe("Puzzle Quest API (Step 02)", () => {
  it("serves client-safe missions with no answer keys anywhere", async () => {
    const res = await missionsGET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("answerKey");
    expect(text).not.toContain("\"points\"");
    const { missions } = JSON.parse(text) as { missions: { id: string; contentStatus: string; challenges: unknown[] }[] };
    expect(missions[0]).toMatchObject({ id: "pq-c6-math-first-steps", contentStatus: "draft-sample" });
    expect(missions[0]?.challenges).toHaveLength(6);
  });

  it("validates session creation and scores answers server-side, ignoring client-claimed scores", async () => {
    expect((await sessionsPOST(post("http://localhost/api/games/sessions", {}))).status).toBe(400);
    expect((await sessionsPOST(post("http://localhost/api/games/sessions", { missionId: "nope" }))).status).toBe(404);

    const created = await sessionsPOST(post("http://localhost/api/games/sessions", { missionId: "pq-c6-math-first-steps" }));
    expect(created.status).toBe(201);
    const { sessionId } = (await created.json()) as { sessionId: string };

    expect((await answerPOST(post("http://localhost/x", { challengeId: "pq1-seq", answer: 11 }), params("missing"))).status).toBe(404);
    expect((await answerPOST(post("http://localhost/x", { answer: 11 }), params(sessionId))).status).toBe(400);

    // The client even claims a score and correctness - both must be ignored.
    const wrong = await answerPOST(post("http://localhost/x", { challengeId: "pq1-seq", answer: 10, correct: true, score: 9999 }), params(sessionId));
    const wrongBody = (await wrong.json()) as { correct: boolean; recorded: boolean; points: number };
    expect(wrongBody).toMatchObject({ correct: false, recorded: false, points: 0 });

    const hint = await hintPOST(post("http://localhost/x", { challengeId: "pq1-seq" }), params(sessionId));
    expect(((await hint.json()) as { level: number }).level).toBe(1);

    const right = await answerPOST(post("http://localhost/x", { challengeId: "pq1-seq", answer: 11, score: 9999 }), params(sessionId));
    const rightBody = (await right.json()) as { correct: boolean; recorded: boolean; result: unknown };
    expect(rightBody).toMatchObject({ correct: true, recorded: true, result: null });
  });
});
