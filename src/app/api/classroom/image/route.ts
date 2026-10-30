import { z } from "zod";
import { generateTopicImage } from "@/lib/meta/media";

/**
 * POST /api/classroom/image — one Meta-generated visualization per topic.
 * Body: { prompt: string } (built by the client from the current topic).
 * Returns { image: dataUrl | null }; null means Meta is unavailable and
 * the whiteboard keeps its drawn (SVG/chart) visualization.
 */
const Body = z.object({ prompt: z.string().min(3).max(600) });

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
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
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const image = await generateTopicImage(parsed.data.prompt);
  return Response.json({ image }, { status: 200 });
}
