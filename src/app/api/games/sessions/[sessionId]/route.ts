import { getSessionSnapshot } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";
import { gameErrorStatus } from "@/lib/game-engine/http";

/**
 * GET /api/games/sessions/[sessionId] - resume snapshot (Step 07).
 * Server-authoritative restore data only: no answer keys, hints, or
 * editable scores. Expired sessions return 410, unknown ids 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await params;
    return Response.json(getSessionSnapshot(sessionId));
  } catch (error) {
    if (error instanceof GameEngineError) {
      return Response.json({ error: error.code, detail: error.message }, { status: gameErrorStatus(error) });
    }
    return Response.json({ error: "INTERNAL", detail: "Could not load that session" }, { status: 500 });
  }
}
