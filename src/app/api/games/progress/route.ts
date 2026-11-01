import { getGameProgress } from "@/lib/game-engine/server";
import { BADGE_DEFINITIONS } from "@/lib/game-engine/rewards";
import { PUZZLE_QUEST_MISSIONS } from "@/lib/game-engine/missions";
import { recommendNextMission } from "@/lib/game-engine/progress";

/**
 * GET /api/games/progress?learnerRef= - session-only game progress.
 * Aggregates only trusted server-computed results. `persistence` is
 * always "session-only" until legal approval enables stored progress;
 * the UI must label it that way.
 */
export async function GET(request: Request): Promise<Response> {
  const learnerRef = new URL(request.url).searchParams.get("learnerRef") ?? "anonymous-device";
  const progress = getGameProgress(learnerRef.slice(0, 100));
  return Response.json({
    progress,
    badges: BADGE_DEFINITIONS,
    nextMission: recommendNextMission(progress, PUZZLE_QUEST_MISSIONS.map((b) => b.mission.id)),
  });
}
