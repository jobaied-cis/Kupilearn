"use client";

/**
 * Client helpers for the Revision Engine. The stable anonymous student id
 * lives in localStorage next to the existing `kupi-profile` / `kupi-learner`
 * keys (Kupi has no login yet). It identifies this device's learner to the
 * revision API via the x-kupi-student-id header - see lib/revision/server.ts.
 */
import type { RecordAttemptInput } from "./types";

const KEY = "kupi-student-id";
export const STUDENT_ID_HEADER = "x-kupi-student-id";

export function getOrCreateStudentId(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `student-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "anonymous-device";
  }
}

export async function revisionFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", [STUDENT_ID_HEADER]: getOrCreateStudentId(), ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Revision request failed (${res.status})`);
  return data as T;
}

/**
 * Fire-and-forget attempt reporting for existing lesson/practice flows.
 * Learning UI must never block or fail because revision reporting failed,
 * so errors are swallowed here (the server pipeline remains the authority).
 */
export interface CheckpointAttempt {
  conceptId: string;
  stepIdx: number;
  question: string;
  isCorrect: boolean;
  studentAnswer: string;
}

/**
 * Duplicate-safe checkpoint reporter. An identical repeat submission for
 * the same checkpoint (same concept, step, question, outcome and answer -
 * e.g. a double click before the phase changes) is submitted once; a
 * different answer, outcome or step is a new attempt. Injectable submit
 * keeps this unit-testable without rendering the classroom.
 */
export function createCheckpointReporter(submit: (input: RecordAttemptInput) => void = submitRevisionAttempt) {
  let lastSignature: string | null = null;
  return (attempt: CheckpointAttempt): boolean => {
    const signature = `${attempt.conceptId}:${attempt.stepIdx}:${attempt.question}:${attempt.isCorrect}:${attempt.studentAnswer}`;
    if (lastSignature === signature) return false;
    lastSignature = signature;
    submit({
      conceptId: attempt.conceptId,
      questionId: `${attempt.conceptId}:checkpoint:${attempt.stepIdx}`,
      studentAnswer: attempt.studentAnswer,
      isCorrect: attempt.isCorrect,
      source: "understanding_check",
    });
    return true;
  };
}

export function submitRevisionAttempt(input: RecordAttemptInput): void {
  try {
    void fetch("/api/revision/attempts", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", [STUDENT_ID_HEADER]: getOrCreateStudentId() },
      body: JSON.stringify(input),
    }).catch(() => undefined);
  } catch {
    /* revision reporting is best-effort from the learning UI */
  }
}