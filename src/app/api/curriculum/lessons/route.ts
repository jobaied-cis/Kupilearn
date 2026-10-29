import {
  EngineException,
  LessonRequestSchema,
  LessonResponseSchema,
} from "@/lib/curriculum/types";
import { generateLesson } from "@/lib/curriculum/engine";
import { createEngineDeps } from "@/lib/curriculum/deps";

/**
 * POST /api/curriculum/lessons
 * Body: { conceptId: string, learnerMastery?: Record<string, number> }
 * Returns the §5 lesson payload, or a structured error payload (§1).
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON", concept_id: "" }, { status: 400 });
  }

  const parsed = LessonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_REQUEST", concept_id: "", detail: parsed.error.message },
      { status: 400 },
    );
  }

  try {
    const response = await generateLesson(parsed.data, createEngineDeps());
    const status =
      response.engine_status === "generation_failed" && response.reason === "CONCEPT_NOT_MAPPED"
        ? 404
        : 200;
    return Response.json(LessonResponseSchema.parse(response), { status });
  } catch (error) {
    if (error instanceof EngineException) {
      return Response.json(error.toPayload(), { status: 503 });
    }
    return Response.json(
      { error: "INTERNAL_ENGINE_ERROR", concept_id: parsed.data.conceptId },
      { status: 500 },
    );
  }
}
