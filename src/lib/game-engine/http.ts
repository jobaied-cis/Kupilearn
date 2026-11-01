import { GameEngineError } from "./types";

/**
 * Bounded JSON body parsing for game API routes (Step 06 hardening).
 * Rejects oversized payloads (413) and malformed JSON (400) before any
 * game logic runs, so a client can never make the server parse or
 * process unbounded input.
 */
export const MAX_JSON_BODY_BYTES = 16_384;

export async function parseJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new GameEngineError("PAYLOAD_TOO_LARGE", "Request body is too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new GameEngineError("PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GameEngineError("INVALID_JSON", "Request body must be valid JSON");
  }
}

export function gameErrorStatus(error: unknown): number {
  if (error instanceof GameEngineError) {
    if (error.code === "PAYLOAD_TOO_LARGE") return 413;
    if (error.code === "SESSION_NOT_FOUND" || error.code === "CHALLENGE_NOT_FOUND" || error.code === "MISSION_NOT_FOUND") return 404;
    if (error.code === "INVALID_JSON" || error.code === "INVALID_REQUEST") return 400;
    return 409;
  }
  return 500;
}
