"use client";

import { PracticeResultSchema, type PracticeResult } from "./engine";

const KEY = "kupi-practice-results";
const MAX_RESULTS = 100;

/** Persisted practice results (this device only, like the learner profile). */
export function loadPracticeResults(): PracticeResult[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = PracticeResultSchema.array().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function appendPracticeResult(result: PracticeResult): PracticeResult[] {
  try {
    const next = [...loadPracticeResults(), result].slice(-MAX_RESULTS);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [result];
  }
}
