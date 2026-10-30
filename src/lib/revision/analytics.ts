import { REVISION_CONFIG } from "./config";
import { computeMasteryScore, deriveMasteryStatus } from "./mastery";
import { addDhakaDays, dhakaDateString, dhakaDayDiff } from "./planning";
import type { MasteryStatus, RevisionAttempt, RevisionSession, StudentConceptMastery } from "./types";

/** Analytics foundation (Section 3E): pure aggregates over stored rows. */
export interface RevisionMetrics {
  conceptsStarted: number;
  conceptsMastered: number;
  weakConcepts: number;
  totalAttempts: number;
  correctAttempts: number;
  /** Null (not 0) when nothing has been attempted yet. */
  accuracy: number | null;
  dueNow: number;
  sessionsCompleted: number;
}

export function computeRevisionMetrics(input: {
  mastery: StudentConceptMastery[];
  attempts: RevisionAttempt[];
  dueNow: number;
  sessionsCompleted: number;
}): RevisionMetrics {
  const totalAttempts = input.attempts.length;
  const correctAttempts = input.attempts.filter((a) => a.isCorrect).length;
  return {
    conceptsStarted: input.mastery.filter((m) => m.totalAttempts > 0).length,
    conceptsMastered: input.mastery.filter((m) => m.masteryStatus === "mastered").length,
    weakConcepts: input.mastery.filter((m) => m.masteryStatus === "weak").length,
    totalAttempts,
    correctAttempts,
    accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 1000) / 1000 : null,
    dueNow: input.dueNow,
    sessionsCompleted: input.sessionsCompleted,
  };
}
export interface DailyTrend {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  sessionsCompleted: number;
}

export interface SubjectTrend {
  subjectId: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
}

export interface SessionTypeTrend {
  sessionType: RevisionSession["sessionType"];
  started: number;
  completed: number;
}

export interface RevisionTrends {
  windowDays: number;
  startDate: string;
  endDate: string;
  daily: DailyTrend[];
  totals: { attempts: number; correct: number; accuracy: number | null; activeDays: number };
  accuracyDeltaPoints: number | null;
  consistency: { activeDays: number; windowDays: number; longestRunDays: number };
  mastery: {
    statusCounts: Record<MasteryStatus, number>;
    masteredAtWindowStart: number;
    masteredNow: number;
    weakAtWindowStart: number;
    weakNow: number;
    improvingConceptIds: string[];
    stillWeakConceptIds: string[];
  };
  subjects: SubjectTrend[];
  unmappedAttempts: number;
  sessionsByType: SessionTypeTrend[];
  attemptsConsidered: number;
  truncated: boolean;
}

const accuracyOf = (correct: number, total: number): number | null =>
  total > 0 ? Math.round((correct / total) * 1000) / 1000 : null;

/** Status a concept had at `at`, replayed from its recorded attempts (Part 03 rules). */
function statusAt(attempts: RevisionAttempt[], at: Date): MasteryStatus {
  const sorted = [...attempts].sort((a, b) => (a.attemptedAt < b.attemptedAt ? -1 : 1));
  let consecutiveCorrect = 0;
  let consecutiveIncorrect = 0;
  for (const a of sorted) {
    if (a.isCorrect) {
      consecutiveCorrect += 1;
      consecutiveIncorrect = 0;
    } else {
      consecutiveIncorrect += 1;
      consecutiveCorrect = 0;
    }
  }
  return deriveMasteryStatus({
    totalAttempts: sorted.length,
    masteryScore: computeMasteryScore(sorted, at),
    consecutiveCorrect,
    consecutiveIncorrect,
  });
}

export function computeRevisionTrends(input: {
  attempts: RevisionAttempt[];
  sessions: RevisionSession[];
  mastery: StudentConceptMastery[];
  subjectByConcept: Map<string, string | null>;
  now: Date;
  windowDays: number;
  truncated?: boolean;
}): RevisionTrends {
  const endDate = dhakaDateString(input.now);
  const startDate = addDhakaDays(endDate, -(input.windowDays - 1));
  const windowStart = new Date(`${startDate}T00:00:00.000+06:00`);
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= windowStart.getTime() && t <= input.now.getTime();
  };
  const dates: string[] = [];
  for (let d = startDate; dhakaDayDiff(d, endDate) >= 0; d = addDhakaDays(d, 1)) dates.push(d);
  const attemptsInWindow = input.attempts.filter((a) => inWindow(a.attemptedAt));
  const byDate = new Map<string, { attempts: number; correct: number; sessionsCompleted: number }>(
    dates.map((d) => [d, { attempts: 0, correct: 0, sessionsCompleted: 0 }]),
  );
  for (const a of attemptsInWindow) {
    const bucket = byDate.get(dhakaDateString(new Date(a.attemptedAt)));
    if (bucket) {
      bucket.attempts += 1;
      if (a.isCorrect) bucket.correct += 1;
    }
  }
  for (const s of input.sessions) {
    if (s.completedAt && inWindow(s.completedAt)) {
      const bucket = byDate.get(dhakaDateString(new Date(s.completedAt)));
      if (bucket) bucket.sessionsCompleted += 1;
    }
  }
  const daily: DailyTrend[] = dates.map((date) => {
    const b = byDate.get(date) ?? { attempts: 0, correct: 0, sessionsCompleted: 0 };
    return { date, attempts: b.attempts, correct: b.correct, accuracy: accuracyOf(b.correct, b.attempts), sessionsCompleted: b.sessionsCompleted };
  });
  const totalAttempts = attemptsInWindow.length;
  const totalCorrect = attemptsInWindow.filter((a) => a.isCorrect).length;
  const activeDays = daily.filter((d) => d.attempts > 0 || d.sessionsCompleted > 0).length;
  let longestRunDays = 0;
  let run = 0;
  for (const d of daily) {
    run = d.attempts > 0 || d.sessionsCompleted > 0 ? run + 1 : 0;
    longestRunDays = Math.max(longestRunDays, run);
  }
  const half = Math.floor(dates.length / 2);
  const halfStats = (slice: DailyTrend[]) => ({
    attempts: slice.reduce((n, d) => n + d.attempts, 0),
    correct: slice.reduce((n, d) => n + d.correct, 0),
  });
  const first = halfStats(daily.slice(0, half));
  const second = halfStats(daily.slice(half));
  const minHalf = REVISION_CONFIG.analytics.minAttemptsPerHalf;
  const accuracyDeltaPoints =
    first.attempts >= minHalf && second.attempts >= minHalf
      ? Math.round((second.correct / second.attempts - first.correct / first.attempts) * 1000) / 10
      : null;
  const statusCounts: Record<MasteryStatus, number> = { not_started: 0, weak: 0, learning: 0, practicing: 0, mastered: 0 };
  for (const m of input.mastery) statusCounts[m.masteryStatus] += 1;
  const attemptsByConcept = new Map<string, RevisionAttempt[]>();
  for (const a of input.attempts) {
    const list = attemptsByConcept.get(a.conceptId) ?? [];
    list.push(a);
    attemptsByConcept.set(a.conceptId, list);
  }
  let masteredAtWindowStart = 0;
  let weakAtWindowStart = 0;
  const improvingConceptIds: string[] = [];
  const nowStatus = new Map(input.mastery.map((m) => [m.conceptId, m.masteryStatus]));
  for (const [conceptId, history] of attemptsByConcept) {
    const before = history.filter((a) => new Date(a.attemptedAt).getTime() < windowStart.getTime());
    if (before.length === 0) continue;
    const startStatus = statusAt(before, windowStart);
    if (startStatus === "mastered") masteredAtWindowStart += 1;
    if (startStatus === "weak") {
      weakAtWindowStart += 1;
      const current = nowStatus.get(conceptId);
      if (current && current !== "weak") improvingConceptIds.push(conceptId);
    }
  }
  improvingConceptIds.sort();
  const subjectMap = new Map<string, { attempts: number; correct: number }>();
  let unmappedAttempts = 0;
  for (const a of attemptsInWindow) {
    const subjectId = input.subjectByConcept.get(a.conceptId) ?? null;
    if (!subjectId) {
      unmappedAttempts += 1;
      continue;
    }
    const entry = subjectMap.get(subjectId) ?? { attempts: 0, correct: 0 };
    entry.attempts += 1;
    if (a.isCorrect) entry.correct += 1;
    subjectMap.set(subjectId, entry);
  }
  const subjects: SubjectTrend[] = [...subjectMap.entries()]
    .map(([subjectId, s]) => ({ subjectId, attempts: s.attempts, correct: s.correct, accuracy: accuracyOf(s.correct, s.attempts) }))
    .sort((a, b) => b.attempts - a.attempts || (a.subjectId < b.subjectId ? -1 : 1));
  const typeMap = new Map<RevisionSession["sessionType"], { started: number; completed: number }>();
  for (const s of input.sessions) {
    if (!inWindow(s.startedAt) && !(s.completedAt && inWindow(s.completedAt))) continue;
    const entry = typeMap.get(s.sessionType) ?? { started: 0, completed: 0 };
    if (inWindow(s.startedAt)) entry.started += 1;
    if (s.completedAt && inWindow(s.completedAt)) entry.completed += 1;
    typeMap.set(s.sessionType, entry);
  }
  const sessionsByType: SessionTypeTrend[] = [...typeMap.entries()]
    .map(([sessionType, s]) => ({ sessionType, started: s.started, completed: s.completed }))
    .sort((a, b) => (a.sessionType < b.sessionType ? -1 : 1));
  return {
    windowDays: input.windowDays,
    startDate,
    endDate,
    daily,
    totals: { attempts: totalAttempts, correct: totalCorrect, accuracy: accuracyOf(totalCorrect, totalAttempts), activeDays },
    accuracyDeltaPoints,
    consistency: { activeDays, windowDays: input.windowDays, longestRunDays },
    mastery: {
      statusCounts,
      masteredAtWindowStart,
      masteredNow: statusCounts.mastered,
      weakAtWindowStart,
      weakNow: statusCounts.weak,
      improvingConceptIds,
      stillWeakConceptIds: input.mastery.filter((m) => m.masteryStatus === "weak").map((m) => m.conceptId).sort(),
    },
    subjects,
    unmappedAttempts,
    sessionsByType,
    attemptsConsidered: input.attempts.length,
    truncated: input.truncated ?? false,
  };
}
