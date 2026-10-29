"use client";

import { LearnerProfileSchema, defaultLearner, type LearnerProfile } from "./adapt";
import { getProfile } from "../profile";

const KEY = "kupi-learner";

export function loadLearner(): LearnerProfile {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return LearnerProfileSchema.parse(JSON.parse(raw));
  } catch { /* fall through */ }
  const base = getProfile();
  return defaultLearner(base?.name ?? "", base?.education ?? "school");
}

export function saveLearner(p: LearnerProfile): void {
  window.localStorage.setItem(KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
}
