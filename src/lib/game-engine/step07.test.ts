import { describe, expect, it } from "vitest";
import { createLessonContextAdapter, createPersonaPromptAdapter, createVisualizationAdapter } from "./adapters";
import { insertTile, moveTile, removeTileAt } from "./mechanics/drag-build";
import { PUZZLE_QUEST_MISSIONS, validateMission } from "./missions";
import { createGameEngine } from "./index";
import { createGameProgressAdapter, InMemoryProgressStore } from "./progress";
import { resolveCurriculumContext } from "./curriculum-context";
import {
  activeSessionCount,
  getSessionSnapshot,
  pruneSessions,
  SESSION_TTL_MS,
  startMissionSession,
  submitMissionAnswer,
} from "./server";

describe("Session resume (Step 07)", () => {
  it("uses opaque UUID session ids and restores progress after a simulated reload", () => {
    const { sessionId } = startMissionSession("pq-c6-math-first-steps", "resume-test");
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    submitMissionAnswer(sessionId, "pq1-seq", 10); // wrong, not recorded
    submitMissionAnswer(sessionId, "pq1-seq", 11); // correct, recorded

    // "Reload": only the opaque id survived (as in localStorage).
    const snap = getSessionSnapshot(sessionId);
    expect(snap.status).toBe("playing");
    expect(snap.currentChallengeId).toBe("pq1-eq");
    expect(snap.answeredChallengeIds).toEqual(["pq1-seq"]);
    expect(JSON.stringify(snap)).not.toContain("answerKey");
    expect(snap.expiresAt).toBeTruthy();

    // Resumed play continues without duplicating the finished challenge.
    expect(() => submitMissionAnswer(sessionId, "pq1-seq", 11)).toThrowError(/already answered/);
    const next = submitMissionAnswer(sessionId, "pq1-eq", 7);
    expect(next.recorded).toBe(true);
  });

  it("rejects unknown and expired sessions safely", () => {
    expect(() => getSessionSnapshot("no-such-session")).toThrowError(/Unknown session/);
    const { sessionId } = startMissionSession("pq-c6-math-first-steps", "expiry-test");
    pruneSessions(Date.now() + SESSION_TTL_MS + 1000);
    expect(() => getSessionSnapshot(sessionId)).toThrowError(/Unknown session/);
    expect(activeSessionCount()).toBeGreaterThanOrEqual(0);
  });
});

describe("Drag & drop tile helpers (Step 07)", () => {
  it("inserts, moves, and removes tiles deterministically", () => {
    expect(insertTile(["3", "+", "4"], "=")).toEqual(["3", "+", "4", "="]);
    expect(insertTile(["3", "4"], "+", 1)).toEqual(["3", "+", "4"]);
    expect(moveTile(["2", "4", "6", "8"], 0, 2)).toEqual(["4", "6", "2", "8"]);
    expect(moveTile(["2", "4"], 5, 0)).toEqual(["2", "4"]); // out of range: unchanged copy
    expect(removeTileAt(["3", "+", "4"], 1)).toEqual(["3", "4"]);
  });
});

describe("Additional missions (Step 07)", () => {
  it("ships two valid, honestly labelled missions whose topics all resolve in the NCTB catalog", () => {
    const engine = createGameEngine();
    const mechanicIds = new Set(engine.mechanics.list().map((m) => m.id));
    expect(PUZZLE_QUEST_MISSIONS.length).toBe(2);
    for (const bundle of PUZZLE_QUEST_MISSIONS) {
      expect(validateMission(bundle, mechanicIds)).toEqual([]);
      expect(bundle.mission.contentStatus).toBe("draft-sample");
      expect(bundle.mission.sourceRef).toContain("Revised Edition Oct 2025");
      for (const challenge of bundle.challenges) {
        expect(resolveCurriculumContext({ classLevel: 6, topicId: challenge.topicId ?? "" })).not.toBeNull();
        expect(challenge.hints).toHaveLength(3);
        expect(challenge.answerKey).toBeDefined();
      }
    }
    const second = PUZZLE_QUEST_MISSIONS[1]!;
    expect(second.mission.id).toBe("pq-c6-math-second-steps");
    const final = second.challenges[second.challenges.length - 1]!;
    expect(final.payload).toMatchObject({ orderMatters: true });
  });

  it("the second mission is fully playable end to end", () => {
    const { sessionId } = startMissionSession("pq-c6-math-second-steps", "mission2-test");
    submitMissionAnswer(sessionId, "pq2-frac", "3/6");
    submitMissionAnswer(sessionId, "pq2-eq", 4);
    submitMissionAnswer(sessionId, "pq2-seq", 10);
    submitMissionAnswer(sessionId, "pq2-shape", 540);
    submitMissionAnswer(sessionId, "pq2-logic", "6");
    const wrongOrder = submitMissionAnswer(sessionId, "pq2-build", ["4", "2", "6", "8"]);
    expect(wrongOrder.correct).toBe(false); // ordered final enforces exact order
    const final = submitMissionAnswer(sessionId, "pq2-build", ["2", "4", "6", "8"]);
    expect(final.progress.status).toBe("completed");
    expect(final.result?.correct).toBe(6);
  });
});

describe("Connected adapters (Step 07)", () => {
  it("lesson adapter returns real lesson questions; visualization adapter describes board steps", async () => {
    const lessons = createLessonContextAdapter();
    const questions = await lessons.questionsFor(6, "c6-math-fractions");
    expect(Array.isArray(questions)).toBe(true);
    const viz = createVisualizationAdapter();
    expect(viz.describe({ kind: "write", content: "Fractions" } as never)).toBe("write");
  });

  it("persona adapter wraps the real classroom builders", () => {
    const adapter = createPersonaPromptAdapter();
    expect(typeof adapter.buildTeacherPrompt).toBe("function");
    expect(typeof adapter.buildClassmatePrompt).toBe("function");
  });

  it("progress adapter records trusted sessions through the real store", async () => {
    const store = new InMemoryProgressStore();
    const adapter = createGameProgressAdapter(store);
    await adapter.recordGameResult({ learnerRef: "x", gameId: "puzzle-quest", correct: 5, answered: 5 });
    // Counts alone are not trusted evidence: nothing was fabricated.
    expect(adapter.getProgress("x").totalXp).toBe(0);
    adapter.recordSession("x", {
      sessionId: "s1",
      missionId: "m1",
      completed: true,
      outcomes: [{ challengeId: "c", mechanicId: "quiz", stage: "main", correct: true, hintsUsed: 0 }],
      xpTotal: 35,
      badges: [],
      completedAt: null,
    });
    expect(adapter.getProgress("x").totalXp).toBe(35);
    expect(await adapter.weakTopicIds("x")).toEqual([]);
  });
});
