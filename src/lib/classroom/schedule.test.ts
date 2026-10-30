import { describe, expect, it } from "vitest";
import { SPEED_OPTIONS, TOPIC_SEQUENCE, isClassSpeed, speakDurationMs, turnGapMs, writeIntervalMs } from "./schedule";

describe("class speed schedule", () => {
  it("only accepts the offered speed options", () => {
    for (const s of SPEED_OPTIONS) expect(isClassSpeed(s)).toBe(true);
    expect(isClassSpeed(2)).toBe(false);
    expect(isClassSpeed(0.5)).toBe(false);
  });

  it("faster classes speak, write and move on sooner", () => {
    const line = "Let us balance both sides of this equation, one small step at a time.";
    expect(speakDurationMs(line, 1.5)).toBeLessThan(speakDurationMs(line, 0.75));
    expect(writeIntervalMs(1.5)).toBeLessThan(writeIntervalMs(0.75));
    expect(turnGapMs(1.5)).toBeLessThan(turnGapMs(0.75));
  });

  it("clamps speaking time so the class never stalls", () => {
    expect(speakDurationMs("Hi", 1)).toBeGreaterThanOrEqual(1800);
    expect(speakDurationMs("x".repeat(4000), 0.75)).toBeLessThanOrEqual(14000);
  });

  it("runs teach, discussion, teacher response, then stops only for the student", () => {
    expect(TOPIC_SEQUENCE).toEqual(["teach", "discuss", "respond", "checkpoint"]);
  });
});
