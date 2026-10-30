/**
 * Whiteboard camera for one continuous, borderless board.
 *
 * Topics are NOT boxes: each topic is a column of writing on the same
 * board. New topics are always added horizontally to the right of the
 * previous one, and a column uses as much vertical space as its content
 * needs (text, equations, diagrams, images) — no fixed topic height.
 * The camera follows the teacher to the active column; students can
 * also pan (drag) and zoom freely.
 */

export const TOPIC_W = 1120;
export const TOPIC_GAP = 72;

export function topicX(index: number): number {
  return index * (TOPIC_W + TOPIC_GAP);
}

/** Total board width grows horizontally with every added topic. */
export function boardWidth(topicCount: number): number {
  if (topicCount <= 0) return TOPIC_W;
  return topicCount * TOPIC_W + (topicCount - 1) * TOPIC_GAP;
}

export interface Camera { x: number; y: number; scale: number }

/**
 * Camera centered horizontally on the active topic column. Vertically it
 * aligns near the top of the writing (columns can be taller than the
 * screen; the student can drag to read further down).
 */
export function cameraForTopic(index: number, viewport: { w: number; h: number }, userZoom = 1): Camera {
  const fit = Math.min(viewport.w / (TOPIC_W + 90), 1);
  const scale = Math.max(0.2, Math.min(1.6, fit * userZoom));
  return {
    scale,
    x: viewport.w / 2 - (topicX(index) + TOPIC_W / 2) * scale,
    y: 14,
  };
}

export function cameraTransform(c: Camera): string {
  return `translate(${c.x}px, ${c.y}px) scale(${c.scale})`;
}
