import { createClassroomDeps } from "@/lib/classroom/deps";
import { runClassroomTurn } from "@/lib/classroom/turn";
import {
  ClassroomException,
  ClassroomTurnRequestSchema,
  ClassroomTurnResponseSchema,
} from "@/lib/classroom/types";

/**
 * POST /api/classroom/turns
 *
 * Runs one classroom tick: Director decides the next speaker, the selected
 * agent generates a typed turn (fidelity-checked, speech-synthesized), and
 * the updated Director state is returned for the client to echo back.
 *
 * Body: { registry?, state?, student_input?, student_answer_correct?,
 *         student_silence_seconds?, adaptation?, learner_addressed_concept? }
 * `turn` is null when the Director routes to the student or terminates.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON", classroom_id: "" }, { status: 400 });
  }

  const parsed = ClassroomTurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_REQUEST", classroom_id: "", detail: parsed.error.message },
      { status: 400 },
    );
  }

  try {
    const response = await runClassroomTurn(parsed.data, createClassroomDeps());
    return Response.json(ClassroomTurnResponseSchema.parse(response), { status: 200 });
  } catch (error) {
    if (error instanceof ClassroomException) {
      return Response.json(error.toPayload(), { status: error.httpStatus });
    }
    return Response.json(
      { error: "INTERNAL_ENGINE_ERROR", classroom_id: parsed.data.registry?.classroom_id ?? "" },
      { status: 500 },
    );
  }
}
