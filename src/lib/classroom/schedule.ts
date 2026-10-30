/**
 * Timing for the automatic Live Class. Everything is derived from the
 * student's Class Speed setting (0.75x–1.5x): speech rate, writing
 * animation, and how long a speaker stays highlighted before the class
 * moves on. Pure functions so the pacing is testable.
 */

export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;
export type ClassSpeed = (typeof SPEED_OPTIONS)[number];

export function isClassSpeed(v: number): v is ClassSpeed {
  return (SPEED_OPTIONS as readonly number[]).includes(v);
}

/** Estimated milliseconds a spoken line stays on screen / highlighted. */
export function speakDurationMs(text: string, speed: number): number {
  const chars = Math.max(1, text.trim().length);
  // ~14 characters per second at 1x, clamped so short lines are readable
  // and long explanations never stall the class.
  return Math.min(14000, Math.max(1800, (chars / 14 / speed) * 1000));
}

/** Milliseconds per character for the whiteboard writing animation. */
export function writeIntervalMs(speed: number): number {
  return Math.max(8, Math.round(26 / speed));
}

/** Pause between two speakers in the automatic sequence. */
export function turnGapMs(speed: number): number {
  return Math.round(650 / speed);
}

/** The automatic sequence for one topic, in order. The class only stops at "checkpoint". */
export type TopicPhase = "teach" | "discuss" | "respond" | "checkpoint" | "praised" | "reteach";
export const TOPIC_SEQUENCE: TopicPhase[] = ["teach", "discuss", "respond", "checkpoint"];
