import { describe, expect, it } from "vitest";
import { allVoiceProfiles, pickVoiceForProfile, voiceProfileFor } from "./voices";
import { CLASSMATES, TEACHERS } from "./catalog";

describe("character voices", () => {
  it("gives every teacher and classmate a distinct pitch/rate profile", () => {
    const all = allVoiceProfiles();
    expect(all.length).toBeGreaterThanOrEqual(12);
    const combos = new Set(all.map(({ profile }) => `${profile.pitch}/${profile.rate}`));
    expect(combos.size).toBe(all.length);
    for (const { profile } of all) {
      expect(profile.pitch).toBeGreaterThanOrEqual(0.5);
      expect(profile.pitch).toBeLessThanOrEqual(1.6);
      expect(profile.rate).toBeGreaterThanOrEqual(0.8);
      expect(profile.rate).toBeLessThanOrEqual(1.2);
      expect(profile.voiceHints.length).toBeGreaterThan(0);
    }
  });

  it("keeps catalog gender, voice gender and selection consistent for everyone", () => {
    const fakeVoices = [
      { name: "Microsoft David - English (United States)", lang: "en-US" },
      { name: "Microsoft Zira - English (United States)", lang: "en-US" },
      { name: "Google UK English Male", lang: "en-GB" },
      { name: "Google UK English Female", lang: "en-GB" },
    ];
    for (const person of [...TEACHERS, ...CLASSMATES]) {
      const profile = voiceProfileFor(person.name);
      expect(profile.gender, `${person.name} voice gender`).toBe(person.gender);
      const picked = pickVoiceForProfile(profile, fakeVoices, person.name);
      expect(picked, `${person.name} picked voice`).toBeTruthy();
      const pickedName = picked!.name.toLowerCase();
      if (person.gender === "male") {
        expect(pickedName).toMatch(/david|male/);
        expect(profile.pitch).toBeLessThanOrEqual(1.15);
      } else {
        expect(pickedName).toMatch(/zira|female/);
        expect(profile.pitch).toBeGreaterThanOrEqual(1.1);
      }
    }
    // Named teachers are the expected genders.
    expect(TEACHERS.find((t) => t.id === "rakib")?.gender).toBe("male");
    expect(TEACHERS.find((t) => t.id === "nasrin")?.gender).toBe("female");
    expect(CLASSMATES.filter((c) => c.gender === "female").map((c) => c.id).sort()).toEqual(["mim", "nabila", "priya", "sumaiya"]);
  });

  it("matches profiles by display name as used in the classroom", () => {
    expect(voiceProfileFor("Rakib Sir").label).toContain("Energetic");
    expect(voiceProfileFor("Nasrin Ma'am").label).toContain("Calm");
    expect(voiceProfileFor("Tamim").label).toContain("Curious");
    expect(voiceProfileFor("Nabila").rate).toBeGreaterThan(voiceProfileFor("Hridoy").rate);
    expect(voiceProfileFor("Unknown").label).toBeTruthy();
  });
});
