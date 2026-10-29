import { describe, expect, it } from "vitest";
import { questionBriefFor, selectQuestionTrigger } from "../questions";
import { createDefaultClassroom } from "../registry";
import { ClassroomRegistrySchema, type TurnHistoryEntry } from "../types";

const registry = ClassroomRegistrySchema.parse(createDefaultClassroom("question_room"));

function last(...entries: TurnHistoryEntry[]): TurnHistoryEntry[] {
  return entries;
}

const teacherDefines = last({
  turn_id: "t1",
  speaker_id: "teacher_01",
  role: "teacher",
  move_type: "direct_instruction",
  text_preview: "An equation balances both sides.",
});

const studentSpeaks = last({
  turn_id: "t2",
  speaker_id: "student",
  role: "student",
  move_type: "student_response",
  text_preview: "x = 9.",
});

describe("contextual question generation (§6)", () => {
  it("asks boundary clarifications after the teacher defines a term", () => {
    expect(selectQuestionTrigger({ history: teacherDefines, studentAnswerCorrect: null })).toBe(
      "boundary_clarification",
    );
  });

  it("asks extension questions after correct learner answers", () => {
    expect(selectQuestionTrigger({ history: studentSpeaks, studentAnswerCorrect: true })).toBe("extension");
  });

  it("makes related mistakes after wrong learner answers (error diagnosis)", () => {
    expect(selectQuestionTrigger({ history: studentSpeaks, studentAnswerCorrect: false })).toBe(
      "related_mistake",
    );
  });

  it("stays silent (standard persona turn) when no trigger matches", () => {
    expect(selectQuestionTrigger({ history: [], studentAnswerCorrect: null })).toBeNull();
    expect(selectQuestionTrigger({ history: studentSpeaks, studentAnswerCorrect: null })).toBeNull();
  });

  it("renders trigger briefs grounded in the current problem", () => {
    expect(questionBriefFor("boundary_clarification", registry.task_schema)).toContain("BOUNDARY CLARIFICATION");
    expect(questionBriefFor("extension", registry.task_schema)).toContain("one level deeper");
    const mistake = questionBriefFor("related_mistake", registry.task_schema);
    expect(mistake).toContain("RELATED MISTAKE");
    expect(mistake).toContain("Do NOT state the correct answer");
    expect(mistake).toContain(registry.task_schema!.problem_statement);
  });
});
