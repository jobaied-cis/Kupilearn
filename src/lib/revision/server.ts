import { RevisionError } from "./types";

/**
 * Student identity + ownership (Sections 4/8).
 * Kupi has NO auth system yet: identity is a local profile on the device
 * (see lib/profile.ts, "No login / no auth" in GetStarted.tsx). Until real
 * auth lands, the client sends its stable anonymous student id in this
 * header and the server enforces one rule everywhere: a request may only
 * read/write the student named by the header. Any `studentId` supplied in
 * a query/body that disagrees with the header is rejected (403), and a
 * missing header is rejected (401) - student data is never served
 * anonymously. Swap `getRequestStudentId` for the real session lookup when
 * auth is introduced; no route or service signature changes.
 */
export const STUDENT_ID_HEADER = "x-kupi-student-id";

export function getRequestStudentId(request: Request): string | null {
  const id = request.headers.get(STUDENT_ID_HEADER)?.trim();
  return id && id.length <= 200 ? id : null;
}

/** Returns the owning studentId, or throws RevisionError(401/403). */
export function requireStudent(request: Request, claimedStudentId?: string | null): string {
  const studentId = getRequestStudentId(request);
  if (!studentId) {
    throw new RevisionError("STUDENT_ID_REQUIRED", 401, `Missing ${STUDENT_ID_HEADER} header`);
  }
  if (claimedStudentId && claimedStudentId !== studentId) {
    throw new RevisionError("FORBIDDEN", 403, "studentId does not match the requesting student");
  }
  return studentId;
}

export function revisionErrorResponse(error: unknown): Response {
  if (error instanceof RevisionError) {
    return Response.json({ error: error.code, detail: error.message }, { status: error.status });
  }
  return Response.json(
    { error: "REVISION_INTERNAL_ERROR", detail: error instanceof Error ? error.message : "unknown" },
    { status: 500 },
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RevisionError("INVALID_JSON", 400, "Request body is not valid JSON");
  }
}