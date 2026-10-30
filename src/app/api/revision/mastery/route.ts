import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";

/** GET /api/revision/mastery?subjectId=&classLevel=&chapterId= - student mastery records. */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const studentId = requireStudent(request, url.searchParams.get("studentId"));
    const classRaw = url.searchParams.get("classLevel");
    const classLevel = classRaw ? Number(classRaw) : undefined;
    if (classLevel !== undefined && (!Number.isInteger(classLevel) || classLevel < 6 || classLevel > 10)) {
      return Response.json({ error: "INVALID_REQUEST", detail: "classLevel must be an integer 6-10" }, { status: 400 });
    }
    const mastery = await createRevisionService().listMastery(studentId, {
      subjectId: url.searchParams.get("subjectId") ?? undefined,
      chapterId: url.searchParams.get("chapterId") ?? undefined,
      classLevel,
    });
    return Response.json({ studentId, mastery });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}