"use client";

import {
  HomeworkAssignmentSchema,
  migrateLegacyDoneFlags,
  starterAssignments,
  type HomeworkAssignment,
} from "./engine";

const KEY = "kupi-homework-v2";
const LEGACY_KEY = "kupi-homework";

/**
 * Persisted homework assignments (this device only). First load seeds the
 * starter set and migrates the legacy `kupi-homework` boolean[] done flags.
 */
export function loadAssignments(classLevel = 6, now: Date = new Date()): HomeworkAssignment[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = HomeworkAssignmentSchema.array().safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
    let list = starterAssignments(now, classLevel);
    try {
      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "[]") as unknown;
      if (Array.isArray(legacy) && legacy.some((v) => typeof v === "boolean")) {
        list = migrateLegacyDoneFlags(list, legacy as boolean[], now);
        window.localStorage.removeItem(LEGACY_KEY);
      }
    } catch { /* legacy flags unreadable — starters stay pending */ }
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  } catch {
    return starterAssignments(now, classLevel);
  }
}

export function saveAssignments(list: HomeworkAssignment[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage unavailable (private mode) — state stays in memory */ }
}

export function addAssignment(
  list: HomeworkAssignment[],
  assignment: HomeworkAssignment,
): HomeworkAssignment[] {
  const next = [assignment, ...list];
  saveAssignments(next);
  return next;
}
