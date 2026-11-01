import { startMissionSession } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";

/** POST /api/games/sessions { missionId } - start a mission session (server-scored). */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { missionId?: unknown };
    if (typeof body.missionId !== "string" || body.missionId.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", detail: "missionId is required" }, { status: 400 });
    }
    const { sessionId, mission } = startMissionSession(body.missionId);
    return Response.json({ sessionId, mission }, { status: 201 });
  } catch (error) {
    if (error instanceof GameEngineError) {
      const status = error.code === "MISSION_NOT_FOUND" ? 404 : 400;
      return Response.json({ error: error.code, detail: error.message }, { status });
    }
    return Response.json({ error: "INTERNAL", detail: "Could not start the session" }, { status: 500 });
  }
}
