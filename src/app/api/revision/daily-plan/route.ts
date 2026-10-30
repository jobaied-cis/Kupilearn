import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { createRevisionService } from "@/lib/revision/service";
import { REVISION_CONFIG } from "@/lib/revision/config";

/**
 * GET /api/revision/daily-plan?days=3 - balanced daily revision plan for
 * the requesting student (Part 05). Read-only: reading the plan never
 * creates or changes a stored record. days is clamped to 1..7.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const studentId = requireStudent(request, url.searchParams.get("studentId"));
    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Number(daysRaw) : REVISION_CONFIG.planning.planningWindowDays;
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return Response.json({ error: "INVALID_REQUEST", detail: "days must be an integer 1-7" }, { status: 400 });
    }
    return Response.json({ studentId, plan: await createRevisionService().getDailyPlan(studentId, days) });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}
