import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";

/** GET /api/revision/overview - metrics, mastery, weak, upcoming, history for the requesting student only. */
export async function GET(request: Request): Promise<Response> {
  try {
    const studentId = requireStudent(request, new URL(request.url).searchParams.get("studentId"));
    return Response.json(await createRevisionService().getOverview(studentId));
  } catch (error) {
    return revisionErrorResponse(error);
  }
}