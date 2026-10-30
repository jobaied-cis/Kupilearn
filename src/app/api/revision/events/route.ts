import { parseJsonBody, requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { RecordEventInputSchema, RevisionError } from "@/lib/revision/types";

/**
 * POST /api/revision/events - record a revision/learning event.
 * Body: { eventType, conceptId?, metadata? } (studentId, if sent, must match the header).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await parseJsonBody(request)) as { studentId?: unknown };
    const studentId = requireStudent(request, typeof body?.studentId === "string" ? body.studentId : null);
    const parsed = RecordEventInputSchema.safeParse(body);
    if (!parsed.success) throw new RevisionError("INVALID_REQUEST", 400, parsed.error.message);
    return Response.json({ event: await createRevisionService().recordEvent(studentId, parsed.data) }, { status: 201 });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}