import { z } from "zod";
import { transcribeAudio } from "@/lib/meta/media";

/**
 * POST /api/classroom/stt — Meta speech-to-text for the student's voice.
 * Body: { audio: base64 (no data: prefix), format: "wav" | "webm" | "mp3" }
 * Returns { text } ("" when nothing was heard, null text when Meta is down).
 */
const Body = z.object({
  audio: z.string().min(10).max(2_800_000),
  format: z.enum(["wav", "webm", "mp3", "ogg"]).default("webm"),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const text = await transcribeAudio(parsed.data.audio, parsed.data.format);
  return Response.json({ text }, { status: 200 });
}
