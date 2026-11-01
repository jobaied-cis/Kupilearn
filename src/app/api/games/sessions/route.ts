import { startMissionSession } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";
import { gameErrorStatus, parseJsonBody } from "@/lib/game-engine/http";

/** POST /api/games/sessions { missionId } - start a mission session (server-scored). */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await parseJsonBody(request)) as { missionId?: unknown; learnerRef?: unknown };
    if (typeof body.missionId !== "string" || body.missionId.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", detail: "missionId is required" }, { status: 400 });
    }
    const learnerRef = typeof body.learnerRef === "string" && body.learnerRef.trim() !== "" ? body.learnerRef.slice(0, 100) : "anonymous-device";
    const { sessionId, mission } = startMissionSession(body.missionId, learnerRef);
    return Response.json({ sessionId, mission }, { status: 201 });
  } catch (error) {
    if (error instanceof GameEngineError) {
      return Response.json({ error: error.code, detail: error.message }, { status: gameErrorStatus(error) });
    }
    return Response.json({ error: "INTERNAL", detail: "Could not start the session" }, { status: 500 });
  }
}
