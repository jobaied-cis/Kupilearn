import { describe, expect, it } from "vitest";
import { POST } from "./route";

function post(body: unknown): Promise<Response> {
  return POST(new Request("http://localhost/api/curriculum/lessons", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

describe("POST /api/curriculum/lessons", () => {
  it("returns 200 with a ready payload for a mastered concept", async () => {
    const res = await post({
      conceptId: "c7-sci-nutrients",
      learnerMastery: {},
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { engine_status: string; concept_id: string };
    expect(json.engine_status).toBe("ready");
    expect(json.concept_id).toBe("c7-sci-nutrients");
  });

  it("returns 200 with remediation_required when a hard prerequisite is missing", async () => {
    const res = await post({ conceptId: "c7-sci-photosynthesis", learnerMastery: {} });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      engine_status: string;
      prerequisite_audit: { missing_prerequisites: string[] };
    };
    expect(json.engine_status).toBe("remediation_required");
    expect(json.prerequisite_audit.missing_prerequisites).toEqual(["c7-sci-nutrition-modes"]);
  });

  it("returns 404 for unmapped concepts", async () => {
    const res = await post({ conceptId: "nope" });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { engine_status: string; reason: string };
    expect(json.engine_status).toBe("generation_failed");
    expect(json.reason).toBe("CONCEPT_NOT_MAPPED");
  });

  it("returns 400 for invalid bodies", async () => {
    const res = await post({ conceptId: "" });
    expect(res.status).toBe(400);
    const badJson = await POST(
      new Request("http://localhost/api/curriculum/lessons", {
        method: "POST",
        body: "not-json{",
      }),
    );
    expect(badJson.status).toBe(400);
  });
});
