"use client";

import {
  PracticeQuestionSchema,
  PracticeResultSchema,
  type PracticeQuestion,
  type PracticeResult,
} from "./engine";

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

/* ---------------- bookmarks ---------------- */

export interface Bookmark {
  id: string;
  question: PracticeQuestion;
  savedAt: string;
}

const BOOKMARK_KEY = "kupi-practice-bookmarks";
const MAX_BOOKMARKS = 50;

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = window.localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const b = entry as { id?: unknown; question?: unknown; savedAt?: unknown };
      const q = PracticeQuestionSchema.safeParse(b.question);
      return typeof b.id === "string" && typeof b.savedAt === "string" && q.success
        ? [{ id: b.id, question: q.data, savedAt: b.savedAt }]
        : [];
    });
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  try {
    window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks.slice(-MAX_BOOKMARKS)));
  } catch { /* storage unavailable — bookmarks stay in memory */ }
}

export function toggleBookmark(bookmarks: Bookmark[], question: PracticeQuestion): Bookmark[] {
  const exists = bookmarks.some((b) => b.question.id === question.id);
  const next = exists
    ? bookmarks.filter((b) => b.question.id !== question.id)
    : [...bookmarks, { id: question.id, question, savedAt: new Date().toISOString() }];
  saveBookmarks(next);
  return next;
}
