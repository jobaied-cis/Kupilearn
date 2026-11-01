import { resumeMissionSession } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";

/** POST /api/games/sessions/[sessionId]/resume */
export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await params;
    return Response.json({ status: resumeMissionSession(sessionId) });
  } catch (error) {
    if (error instanceof GameEngineError) return Response.json({ error: error.code, detail: error.message }, { status: 404 });
    return Response.json({ error: "INTERNAL", detail: "Could not resume" }, { status: 500 });
  }
}
