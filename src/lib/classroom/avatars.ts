import type { Gender } from "./catalog";

/**
 * Gendered avatar appearance. Male and female characters must be visually
 * distinct at a glance — not just a hairstyle tweak:
 * - female: long hair down both sides (or a bun), warm top, earrings
 * - male: short hair on top only, cool top, no earrings
 */

export interface AvatarStyle {
  hairStyle: "long" | "bun" | "side" | "short" | "cap";
  topColor: string;
  earrings: boolean;
}

const FEMALE_TOPS = ["#e4486f", "#e8731a", "#7c3aed", "#db2777"];
const MALE_TOPS = ["#2459c7", "#0f766e", "#334155", "#0369a1"];
const FEMALE_HAIR = ["long", "bun", "side"] as const;
const MALE_HAIR = ["short", "cap"] as const;

export function avatarStyleFor(gender: Gender, name: string): AvatarStyle {
  const seed = [...name].reduce((s, c) => s + c.charCodeAt(0) * 7, 0);
  if (gender === "female") {
    return {
      hairStyle: FEMALE_HAIR[seed % FEMALE_HAIR.length]!,
      topColor: FEMALE_TOPS[seed % FEMALE_TOPS.length]!,
      earrings: true,
    };
  }
  return {
    hairStyle: MALE_HAIR[seed % MALE_HAIR.length]!,
    topColor: MALE_TOPS[seed % MALE_TOPS.length]!,
    earrings: false,
  };
}
