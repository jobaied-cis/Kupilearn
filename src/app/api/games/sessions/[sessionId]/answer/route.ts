import { submitMissionAnswer } from "@/lib/game-engine/server";
import { GameEngineError } from "@/lib/game-engine/types";
import { gameErrorStatus, parseJsonBody } from "@/lib/game-engine/http";

/**
 * POST /api/games/sessions/[sessionId]/answer { challengeId, answer }
 * Server-side validation only — the client never sends correctness or
 * score, and any such fields in the body are ignored.
 */
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await params;
    const body = (await parseJsonBody(request)) as { challengeId?: unknown; answer?: unknown };
    if (typeof body.challengeId !== "string" || body.challengeId.trim() === "") {
      return Response.json({ error: "INVALID_REQUEST", detail: "challengeId is required" }, { status: 400 });
    }
    if (!("answer" in body)) {
      return Response.json({ error: "INVALID_REQUEST", detail: "answer is required" }, { status: 400 });
    }
    return Response.json(submitMissionAnswer(sessionId, body.challengeId, body.answer));
  } catch (error) {
    if (error instanceof GameEngineError) {
      return Response.json({ error: error.code, detail: error.message }, { status: gameErrorStatus(error) });
    }
    return Response.json({ error: "INTERNAL", detail: "Could not check that answer" }, { status: 500 });
  }
}
