import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";

/**
 * GET /api/revision/targeted-quiz - ranked weak (or due) concepts with
 * recently-correct question indexes for the targeted quiz (Part 07).
 * Read-only; same student ownership as every revision route.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const studentId = requireStudent(request, new URL(request.url).searchParams.get("studentId"));
    return Response.json({ studentId, quiz: await createRevisionService().getTargetedQuiz(studentId) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}
