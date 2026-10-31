import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { REVISION_CONFIG } from "@/lib/revision/config";

/** GET /api/revision/upcoming?days=7 - schedules due now or within the window. */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const studentId = requireStudent(request, url.searchParams.get("studentId"));
    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Number(daysRaw) : REVISION_CONFIG.upcomingWindowDays;
    if (!Number.isInteger(days) || days < 0 || days > 90) {
      return Response.json({ error: "INVALID_REQUEST", detail: "days must be an integer 0-90" }, { status: 400 });
    }
    return Response.json({ studentId, upcoming: await createRevisionService().getUpcoming(studentId, days) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}