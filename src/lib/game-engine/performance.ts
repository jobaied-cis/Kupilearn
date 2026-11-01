/**
 * Session-only learner performance model (Step 03).
 *
 * Tracks only the evidence the adaptive, misconception, and
 * recommendation engines need for THIS session: attempts, hints,
 * difficulty, per-mechanic results, repeated error patterns, and
 * completed learning objectives. It holds no identity, infers no
 * trait, and is discarded with the session — nothing here is a
 * persistent profile or analytics record.
 */
export interface AttemptEvidence {
  challengeId: string;
  mechanicId: string;
  correct: boolean;
  attemptsUsed: number;
  hintsUsed: number;
  difficulty: 1 | 2 | 3;
  /** Optional, only when the client legitimately measured it. */
  durationMs?: number;
  learningObjective?: string;
  at: string;
}

export interface MechanicPerformance {
  answered: number;
  correct: number;
  incorrect: number;
  hintsUsed: number;
}

export interface PerformanceSnapshot {
  answered: number;
  correct: number;
  incorrect: number;
  totalAttempts: number;
  totalHints: number;
  currentCorrectStreak: number;
  currentIncorrectStreak: number;
  perMechanic: Record<string, MechanicPerformance>;
  /** Repeated error pattern keys ("mechanic:pattern") with counts >= 2. */
  repeatedErrorPatterns: Record<string, number>;
  completedObjectives: string[];
  evidence: AttemptEvidence[];
}

export class SessionPerformance {
  private evidence: AttemptEvidence[] = [];
  private errorPatterns = new Map<string, number>();
  private objectives = new Set<string>();

  record(entry: AttemptEvidence, errorPatternKey?: string): void {
    this.evidence.push(entry);
    if (!entry.correct && errorPatternKey) {
      this.errorPatterns.set(errorPatternKey, (this.errorPatterns.get(errorPatternKey) ?? 0) + 1);
    }
    if (entry.correct && entry.learningObjective) this.objectives.add(entry.learningObjective);
  }

  errorPatternCount(key: string): number {
    return this.errorPatterns.get(key) ?? 0;
  }

  snapshot(): PerformanceSnapshot {
    const perMechanic: Record<string, MechanicPerformance> = {};
    let totalAttempts = 0;
    let totalHints = 0;
    for (const e of this.evidence) {
      totalAttempts += e.attemptsUsed;
      totalHints += e.hintsUsed;
      const m = perMechanic[e.mechanicId] ?? { answered: 0, correct: 0, incorrect: 0, hintsUsed: 0 };
      m.answered += 1;
      if (e.correct) m.correct += 1;
      else m.incorrect += 1;
      m.hintsUsed += e.hintsUsed;
      perMechanic[e.mechanicId] = m;
    }
    let currentCorrectStreak = 0;
    let currentIncorrectStreak = 0;
    for (let i = this.evidence.length - 1; i >= 0; i--) {
      const e = this.evidence[i]!;
      if (e.correct && currentIncorrectStreak === 0) currentCorrectStreak += 1;
      else if (!e.correct && currentCorrectStreak === 0) currentIncorrectStreak += 1;
      else break;
    }
    const repeatedErrorPatterns: Record<string, number> = {};
    for (const [key, count] of this.errorPatterns) {
      if (count >= 2) repeatedErrorPatterns[key] = count;
    }
    return {
      answered: this.evidence.length,
      correct: this.evidence.filter((e) => e.correct).length,
      incorrect: this.evidence.filter((e) => !e.correct).length,
      totalAttempts,
      totalHints,
      currentCorrectStreak,
      currentIncorrectStreak,
      perMechanic,
      repeatedErrorPatterns,
      completedObjectives: [...this.objectives],
      evidence: [...this.evidence],
    };
  }
}
