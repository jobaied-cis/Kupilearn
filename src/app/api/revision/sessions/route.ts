import { parseJsonBody, requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { RevisionError, StartSessionInputSchema } from "@/lib/revision/types";
import { z } from "zod";

const CompleteBody = z.object({ action: z.literal("complete"), sessionId: z.string().min(1).max(200) });

/** GET /api/revision/sessions?sessionId= - one session, or the student's session history without sessionId. */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const studentId = requireStudent(request, url.searchParams.get("studentId"));
    const service = createRevisionService();
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId) return Response.json({ session: await service.getSession(studentId, sessionId) });
    const overview = await service.getOverview(studentId);
    return Response.json({ studentId, sessions: overview.recentSessions });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}

/** POST /api/revision/sessions - { sessionType? } starts; { action:"complete", sessionId } completes. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await parseJsonBody(request)) as { studentId?: unknown; action?: unknown };
    const studentId = requireStudent(request, typeof body?.studentId === "string" ? body.studentId : null);
    const service = createRevisionService();
    if (body?.action === "complete") {
      const parsed = CompleteBody.safeParse(body);
      if (!parsed.success) throw new RevisionError("INVALID_REQUEST", 400, parsed.error.message);
      return Response.json({ session: await service.completeSession(studentId, parsed.data.sessionId) });
    }
    const parsed = StartSessionInputSchema.safeParse(body ?? {});
    if (!parsed.success) throw new RevisionError("INVALID_REQUEST", 400, parsed.error.message);
    return Response.json({ session: await service.startSession(studentId, parsed.data.sessionType) }, { status: 201 });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}