import { z } from "zod";
import { generateLesson } from "@/lib/lesson/engine";

/**
 * POST /api/lessons — Lesson & Context Engine (server-side, Meta-only).
 * Body: { classLevel: 6-10, topicId?, language?: "en"|"bn", difficulty?: 1-3 }
 * Returns a validated StructuredLesson. When Meta is not configured the
 * deterministic offline lesson is returned with degraded: true.
 */
const Body = z.object({
  classLevel: z.number().int().min(6).max(10),
  topicId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  query: z.string().min(1).max(300).optional(),
  language: z.enum(["en", "bn"]).default("en"),
  difficulty: z.number().int().min(1).max(3).optional(),
});

// Tiny in-memory rate limit per IP (production: use a shared store).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (rateLimited(ip)) return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_REQUEST", detail: parsed.error.message }, { status: 400 });
  }
  try {
    const result = await generateLesson(parsed.data);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: "LESSON_FAILED", detail: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}
