import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { REVISION_CONFIG } from "@/lib/revision/config";

/**
 * GET /api/revision/trends?days=7|30|90 - learning analytics & trends
 * (Part 10). Read-only derivation over recorded attempts, sessions,
 * and mastery; same student ownership as every revision route.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const studentId = requireStudent(request, url.searchParams.get("studentId"));
    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Number(daysRaw) : REVISION_CONFIG.analytics.defaultWindowDays;
    if (!Number.isInteger(days) || !(REVISION_CONFIG.analytics.allowedWindowDays as readonly number[]).includes(days)) {
      return Response.json({ error: "INVALID_REQUEST", detail: "days must be one of 7, 30, 90" }, { status: 400 });
    }
    return Response.json({ studentId, trends: await createRevisionService().getTrends(studentId, days) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}
