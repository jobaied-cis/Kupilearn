import { requestMissionHint } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";

/** POST /api/games/sessions/[sessionId]/hint { challengeId } - next progressive hint level. */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { challengeId?: unknown };
    if (typeof body.challengeId !== "string" || body.challengeId.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", detail: "challengeId is required" }, { status: 400 });
    }
    return Response.json(requestMissionHint(sessionId, body.challengeId));
  } catch (error) {
    if (error instanceof GameEngineError) {
      const status = error.code === "SESSION_NOT_FOUND" || error.code === "CHALLENGE_NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.code, detail: error.message }, { status });
    }
    return Response.json({ error: "INTERNAL", detail: "Could not load a hint" }, { status: 500 });
  }
}
