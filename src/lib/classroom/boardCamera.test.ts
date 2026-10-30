import { describe, expect, it } from "vitest";
import { TOPIC_GAP, TOPIC_W, boardWidth, cameraForTopic, cameraTransform, topicX } from "./boardCamera";

describe("continuous whiteboard layout", () => {
  it("always adds new topics horizontally to the right, never stacked", () => {
    expect(topicX(0)).toBe(0);
    for (let i = 1; i < 6; i += 1) {
      expect(topicX(i)).toBe(topicX(i - 1) + TOPIC_W + TOPIC_GAP);
      expect(topicX(i)).toBeGreaterThan(topicX(i - 1));
    }
    // The board only grows sideways; there is no fixed per-topic height.
    expect(boardWidth(1)).toBe(TOPIC_W);
    expect(boardWidth(4)).toBe(4 * TOPIC_W + 3 * TOPIC_GAP);
    expect(boardWidth(6)).toBeGreaterThan(boardWidth(4));
  });

  it("centers the active topic column horizontally in the viewport", () => {
    const vp = { w: 1280, h: 640 };
    for (const i of [0, 1, 2, 4]) {
      const cam = cameraForTopic(i, vp);
      const cx = cam.x + (topicX(i) + TOPIC_W / 2) * cam.scale;
      expect(cx).toBeCloseTo(vp.w / 2);
      expect(cam.y).toBe(14);
      expect(cam.scale).toBeGreaterThan(0.2);
      expect(cam.scale).toBeLessThanOrEqual(1.6);
    }
  });

  it("zooming increases scale around the same topic", () => {
    const vp = { w: 1280, h: 640 };
    expect(cameraForTopic(1, vp, 1.4).scale).toBeGreaterThan(cameraForTopic(1, vp, 0.8).scale);
    expect(cameraTransform({ x: 10, y: -5, scale: 0.9 })).toBe("translate(10px, -5px) scale(0.9)");
  });
});
