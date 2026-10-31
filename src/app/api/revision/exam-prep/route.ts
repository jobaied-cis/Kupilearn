import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";

/**
 * GET /api/revision/exam-prep - ranked attempted concepts for an
 * exam preparation session (Part 09): weak first, mastered last.
 * Read-only; same student ownership as every revision route. No exam
 * dates, syllabus weights, or readiness scores are returned.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const studentId = requireStudent(request, new URL(request.url).searchParams.get("studentId"));
    return Response.json({ studentId, exam: await createRevisionService().getExamPrep(studentId) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}
