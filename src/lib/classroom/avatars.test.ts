import { describe, expect, it } from "vitest";
import { avatarStyleFor } from "./avatars";
import { CLASSMATES, TEACHERS } from "./catalog";

describe("gendered avatars", () => {
  it("female characters get long/bun hair, warm tops and earrings; males get short hair and cool tops", () => {
    for (const p of [...TEACHERS, ...CLASSMATES]) {
      const style = avatarStyleFor(p.gender, p.name);
      if (p.gender === "female") {
        expect(["long", "bun", "side"]).toContain(style.hairStyle);
        expect(style.earrings).toBe(true);
      } else {
        expect(["short", "cap"]).toContain(style.hairStyle);
        expect(style.earrings).toBe(false);
      }
    }
    expect(avatarStyleFor("female", "Nasrin Ma'am").hairStyle).not.toBe(avatarStyleFor("male", "Rakib Sir").hairStyle);
  });
});
