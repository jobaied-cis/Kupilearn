import { aiErrorStatus, getAiService } from "@/lib/game-engine/ai-service";
import { DIRECTOR_ACTIONS, type DirectorAction } from "@/lib/game-engine/director";
import { parseJsonBody } from "@/lib/game-engine/http";

/**
 * POST /api/games/sessions/[sessionId]/director
 * { action, challengeId, personaId?, hintLevel?, studentText?, lang? }
 *
 * Meta-only AI help (teacher/classmates/director) with deterministic
 * fallback. Returns display text only — it can never change scores,
 * correctness, difficulty, or game state.
 */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await params;
    const body = (await parseJsonBody(request)) as {
      action?: unknown;
      challengeId?: unknown;
      personaId?: unknown;
      hintLevel?: unknown;
      studentText?: unknown;
      lang?: unknown;
    };
    if (typeof body.action !== "string" || !DIRECTOR_ACTIONS.includes(body.action as DirectorAction)) {
      return Response.json({ error: "INVALID_REQUEST", detail: "action must be a supported director action" }, { status: 400 });
    }
    if (typeof body.challengeId !== "string" || body.challengeId.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", detail: "challengeId is required" }, { status: 400 });
    }
    const response = await getAiService().act({
      sessionId,
      challengeId: body.challengeId,
      action: body.action as DirectorAction,
      personaId: typeof body.personaId === "string" ? body.personaId : undefined,
      hintLevel: typeof body.hintLevel === "number" ? body.hintLevel : undefined,
      studentText: typeof body.studentText === "string" ? body.studentText : undefined,
      lang: body.lang === "bn" ? "bn" : "en",
    });
    return Response.json(response);
  } catch (error) {
    const status = aiErrorStatus(error);
    return Response.json(
      { error: status === 404 ? "NOT_FOUND" : status === 413 ? "PAYLOAD_TOO_LARGE" : status === 400 ? "INVALID_REQUEST" : "AI_UNAVAILABLE", detail: error instanceof Error ? error.message : "AI help failed" },
      { status },
    );
  }
}
