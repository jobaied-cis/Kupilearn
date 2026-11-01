import { listClientMissions } from "@/lib/game-engine/server";

/** GET /api/games/missions - Puzzle Quest missions, client-safe (no answer keys). */
export async function GET(): Promise<Response> {
  return Response.json({ missions: listClientMissions() });
}
