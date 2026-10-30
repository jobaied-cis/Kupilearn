import { requireStudent, revisionErrorResponse } from "@/lib/revision/server";
import { getRevisionContentService } from "@/lib/revision/content";
import { RevisionError } from "@/lib/revision/types";

/**
 * GET /api/revision/content?conceptId=&lang=en|bn - revision explanation
 * and flashcards for one concept (Part 08). Generated on demand through
 * the Meta-only LLM path with a deterministic offline fallback; the
 * response `source` says which. Read-only; creates no learner records.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    requireStudent(request, url.searchParams.get("studentId"));
    const conceptId = url.searchParams.get("conceptId");
    if (!conceptId) throw new RevisionError("INVALID_REQUEST", 400, "conceptId is required");
    const langRaw = url.searchParams.get("lang") ?? "en";
    if (langRaw !== "en" && langRaw !== "bn") {
      return Response.json({ error: "INVALID_REQUEST", detail: "lang must be en or bn" }, { status: 400 });
    }
    const content = await getRevisionContentService().getContent(conceptId, langRaw);
    return Response.json({ content });
  } catch (error) {
    return revisionErrorResponse(error);
  }
}
