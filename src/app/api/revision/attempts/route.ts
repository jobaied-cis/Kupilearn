import { parseJsonBody, requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { RecordAttemptInputSchema, RevisionError } from "@/lib/revision/types";

/**
 * POST /api/revision/attempts - record one answered question.
 * Body: { conceptId, isCorrect, questionId?, studentAnswer?, difficulty?,
 *         responseTimeMs?, sessionId?, source? }
 * Mastery scores are computed server-side; any client-sent score is ignored.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await parseJsonBody(request)) as { studentId?: unknown };
    const studentId = requireStudent(request, typeof body?.studentId === "string" ? body.studentId : null);
    const parsed = RecordAttemptInputSchema.safeParse(body);
    if (!parsed.success) throw new RevisionError("INVALID_REQUEST", 400, parsed.error.message);
    return Response.json(await createRevisionService().recordAttempt(studentId, parsed.data), { status: 201 });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}