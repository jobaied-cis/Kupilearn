import { beforeEach, describe, expect, it } from "vitest";
import { GET as overviewGET } from "./overview/route";
import { GET as masteryGET } from "./mastery/route";
import { GET as weakGET } from "./weak-concepts/route";
import { GET as upcomingGET } from "./upcoming/route";
import { POST as attemptsPOST } from "./attempts/route";
import { POST as eventsPOST } from "./events/route";
import { GET as sessionsGET, POST as sessionsPOST } from "./sessions/route";
import { GET as dailyPlanGET } from "./daily-plan/route";
import { GET as targetedQuizGET } from "./targeted-quiz/route";
import { GET as contentGET } from "./content/route";
import { InMemoryRevisionRepository, setRevisionRepositoryForTests } from "@/lib/revision/repository";

const CONCEPT = "c8-math-algebraic";
const H = (studentId?: string) => ({ "content-type": "application/json", ...(studentId ? { "x-kupi-student-id": studentId } : {}) });

function post(url: string, body: unknown, studentId = "stu-1"): Promise<Response> {
  return attemptsPOST(new Request(url, { method: "POST", headers: H(studentId), body: typeof body === "string" ? body : JSON.stringify(body) }));
}
function get(url: string, studentId?: string): Promise<Response> {
  return overviewGET(new Request(url, { headers: H(studentId) }));
}

beforeEach(() => {
  setRevisionRepositoryForTests(new InMemoryRevisionRepository());
});

describe("revision API ownership", () => {
  it("rejects requests without a student id (401) and mismatched students (403)", async () => {
    expect((await get("http://localhost/api/revision/overview")).status).toBe(401);
    expect((await get("http://localhost/api/revision/overview?studentId=stu-2", "stu-1")).status).toBe(403);
    expect((await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: true, studentId: "stu-2" })).status).toBe(403);
  });

  it("never serves another student's data", async () => {
    await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: true });
    const mine = await (await get("http://localhost/api/revision/overview", "stu-1")).json() as { metrics: { totalAttempts: number } };
    const theirs = await (await get("http://localhost/api/revision/overview", "stu-2")).json() as { metrics: { totalAttempts: number }; mastery: unknown[] };
    expect(mine.metrics.totalAttempts).toBe(1);
    expect(theirs.metrics.totalAttempts).toBe(0);
    expect(theirs.mastery).toEqual([]);
  });
});

describe("POST /api/revision/attempts", () => {
  it("records correct and incorrect attempts; mastery is computed server-side only", async () => {
    const forged = await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: false, masteryScore: 1, masteryStatus: "mastered" });
    expect(forged.status).toBe(201);
    const forgedJson = await forged.json() as { mastery: { masteryScore: number; masteryStatus: string } };
    expect(forgedJson.mastery.masteryScore).toBe(0.333);
    expect(forgedJson.mastery.masteryStatus).not.toBe("mastered");

    const good = await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: true, questionId: "q1", studentAnswer: "Read carefully" });
    expect(good.status).toBe(201);
    const json = await good.json() as { mastery: { totalAttempts: number; correctAttempts: number; masteryScore: number } };
    expect(json.mastery).toMatchObject({ totalAttempts: 2, correctAttempts: 1, masteryScore: 0.5 });
  });

  it("404s unknown concepts and writes nothing for them", async () => {
    const res = await post("http://localhost/api/revision/attempts", { conceptId: "c6m-ch4", isCorrect: true });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("CONCEPT_NOT_FOUND");
    const overview = await (await get("http://localhost/api/revision/overview", "stu-1")).json() as { mastery: unknown[] };
    expect(overview.mastery).toEqual([]);
  });

  it("400s invalid bodies and invalid JSON", async () => {
    expect((await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT })).status).toBe(400);
    expect((await post("http://localhost/api/revision/attempts", "not-json{")).status).toBe(400);
    expect((await post("http://localhost/api/revision/attempts", { conceptId: "", isCorrect: true })).status).toBe(400);
  });
});

describe("GET /api/revision/daily-plan (Part 05)", () => {
  it("requires the student header, validates days, and isolates students", async () => {
    await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: false });
    expect((await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan"))).status).toBe(401);
    expect((await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan?studentId=stu-2", { headers: H("stu-1") }))).status).toBe(403);
    expect((await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan?days=0", { headers: H("stu-1") }))).status).toBe(400);
    expect((await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan?days=8", { headers: H("stu-1") }))).status).toBe(400);

    const mine = await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan?days=3", { headers: H("stu-1") }));
    expect(mine.status).toBe(200);
    const json = (await mine.json()) as { plan: { days: { items: unknown[] }[]; totalDue: number } };
    expect(json.plan.days).toHaveLength(3);

    const theirs = await dailyPlanGET(new Request("http://localhost/api/revision/daily-plan", { headers: H("stu-2") }));
    expect(((await theirs.json()) as { plan: { totalDue: number } }).plan.totalDue).toBe(0);
  });
});

describe("GET /api/revision/targeted-quiz (Part 07)", () => {
  it("requires ownership and returns an honest empty queue for a new student", async () => {
    expect((await targetedQuizGET(new Request("http://localhost/api/revision/targeted-quiz"))).status).toBe(401);
    expect((await targetedQuizGET(new Request("http://localhost/api/revision/targeted-quiz?studentId=stu-2", { headers: H("stu-1") }))).status).toBe(403);
    const res = await targetedQuizGET(new Request("http://localhost/api/revision/targeted-quiz", { headers: H("stu-1") }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { quiz: { source: string; concepts: unknown[] } }).quiz).toEqual({ source: "none", concepts: [] });
  });
});

describe("GET /api/revision/content (Part 08)", () => {
  it("requires ownership, validates lang and concept, and serves content", async () => {
    expect((await contentGET(new Request("http://localhost/api/revision/content?conceptId=c8-math-algebraic"))).status).toBe(401);
    expect((await contentGET(new Request("http://localhost/api/revision/content?conceptId=c8-math-algebraic&studentId=stu-2", { headers: H("stu-1") }))).status).toBe(403);
    expect((await contentGET(new Request("http://localhost/api/revision/content", { headers: H("stu-1") }))).status).toBe(400);
    expect((await contentGET(new Request("http://localhost/api/revision/content?conceptId=c8-math-algebraic&lang=fr", { headers: H("stu-1") }))).status).toBe(400);
    expect((await contentGET(new Request("http://localhost/api/revision/content?conceptId=c6m-ch4", { headers: H("stu-1") }))).status).toBe(404);
    const ok = await contentGET(new Request("http://localhost/api/revision/content?conceptId=c8-math-algebraic&lang=bn", { headers: H("stu-1") }));
    expect(ok.status).toBe(200);
    const { content } = (await ok.json()) as { content: { conceptId: string; language: string; source: string; flashcards: unknown[] } };
    expect(content.conceptId).toBe("c8-math-algebraic");
    expect(content.language).toBe("bn");
    expect(["meta", "offline"]).toContain(content.source);
    expect(content.flashcards.length).toBeGreaterThanOrEqual(3);
  });
});

describe("revision read + session + event routes", () => {
  it("mastery, weak-concepts and upcoming reflect recorded attempts", async () => {
    await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: false });
    await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: false });

    const masteryRes = await masteryGET(new Request("http://localhost/api/revision/mastery", { headers: H("stu-1") }));
    expect(masteryRes.status).toBe(200);
    expect(((await masteryRes.json()) as { mastery: unknown[] }).mastery).toHaveLength(1);

    const weakRes = await weakGET(new Request("http://localhost/api/revision/weak-concepts", { headers: H("stu-1") }));
    expect(((await weakRes.json()) as { weakConcepts: { conceptId: string }[] }).weakConcepts.map((w) => w.conceptId)).toEqual([CONCEPT]);

    const upcomingRes = await upcomingGET(new Request("http://localhost/api/revision/upcoming?days=7", { headers: H("stu-1") }));
    expect(((await upcomingRes.json()) as { upcoming: unknown[] }).upcoming).toHaveLength(1);
    expect((await upcomingGET(new Request("http://localhost/api/revision/upcoming?days=999", { headers: H("stu-1") }))).status).toBe(400);
  });

  it("events are validated and sessions start, tally and complete", async () => {
    const bad = await eventsPOST(new Request("http://localhost/api/revision/events", { method: "POST", headers: H("stu-1"), body: JSON.stringify({ eventType: "nope" }) }));
    expect(bad.status).toBe(400);
    const ok = await eventsPOST(new Request("http://localhost/api/revision/events", { method: "POST", headers: H("stu-1"), body: JSON.stringify({ eventType: "concept_viewed", conceptId: CONCEPT }) }));
    expect(ok.status).toBe(201);

    const started = await sessionsPOST(new Request("http://localhost/api/revision/sessions", { method: "POST", headers: H("stu-1"), body: JSON.stringify({ sessionType: "daily" }) }));
    expect(started.status).toBe(201);
    const { session } = await started.json() as { session: { sessionId: string } };
    await post("http://localhost/api/revision/attempts", { conceptId: CONCEPT, isCorrect: true, sessionId: session.sessionId });

    const fetched = await sessionsGET(new Request(`http://localhost/api/revision/sessions?sessionId=${session.sessionId}`, { headers: H("stu-1") }));
    expect(((await fetched.json()) as { session: { totalQuestions: number } }).session.totalQuestions).toBe(1);
    const foreign = await sessionsGET(new Request(`http://localhost/api/revision/sessions?sessionId=${session.sessionId}`, { headers: H("stu-2") }));
    expect(foreign.status).toBe(404);
  });
});
