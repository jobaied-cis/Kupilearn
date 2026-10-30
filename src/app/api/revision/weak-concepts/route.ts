import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";

/** GET /api/revision/weak-concepts - concepts flagged weak for the requesting student. */
export async function GET(request: Request): Promise<Response> {
  try {
    const studentId = requireStudent(request, new URL(request.url).searchParams.get("studentId"));
    return Response.json({ studentId, weakConcepts: await createRevisionService().getWeakConcepts(studentId) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}