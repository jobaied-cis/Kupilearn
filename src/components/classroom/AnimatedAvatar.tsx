"use client";

/**
 * Animated classroom avatar (SVG face, no static photo):
 * - idle: gentle bob + blinking eyes
 * - speaking: mouth talks, head bobs faster, glowing highlight ring
 * - reacting (just finished speaking / addressed): a quick happy nod
 * Appearance (hair, skin tone, glasses) is derived from the name so every
 * teacher and classmate looks different. Respects prefers-reduced-motion
 * via the global animation rules.
 */

import { avatarStyleFor } from "../../lib/classroom/avatars";

const SKIN = ["#f2c79b", "#e0ac82", "#c68863", "#a9714b"];
const HAIR = ["#1f2430", "#3b2a20", "#5a3a1a", "#111827", "#4a2c2a"];

function seedOf(name: string): number {
  return [...name].reduce((s, c) => s + c.charCodeAt(0) * 7, 0);
}

export function AnimatedAvatar({ name, color, speaking, reacting = false, big = false, gender = "male" }: {
  name: string;
  color: string;
  speaking: boolean;
  reacting?: boolean;
  big?: boolean;
  /** Avatar presentation always matches the character's assigned gender. */
  gender?: "male" | "female";
}) {
  const seed = seedOf(name);
  const skin = SKIN[seed % SKIN.length];
  const hair = HAIR[seed % HAIR.length];
  const look = avatarStyleFor(gender, name);
  const style = look.hairStyle;
  const glasses = seed % 3 === 0;

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span
        aria-label={`${name}${speaking ? ", speaking now" : ""}`}
        className={`relative grid place-items-center overflow-hidden rounded-full border-[3px] transition-all duration-300 ${big ? "size-20 sm:size-24" : "size-12 sm:size-16"} ${speaking ? "avatar-speaking scale-110 border-flame" : reacting ? "avatar-react border-kolapata" : "border-ink/70"} ${color}`}
      >
        <svg viewBox="0 0 100 100" className={`h-full w-full ${speaking ? "avatar-head-talk" : "avatar-head-idle"}`} aria-hidden="true" focusable="false">
          {/* long female hair behind the face/shoulders */}
          {gender === "female" && style !== "bun" ? <path d="M22 96 C16 40 28 12 50 12 C72 12 84 40 78 96 L63 96 C67 60 66 40 60 28 L40 28 C34 40 33 60 37 96Z" fill={hair} /> : null}
          {/* shoulders / top — warm colours for female, cool for male */}
          <path d="M18 100 C22 78 34 70 50 70 C66 70 78 78 82 100 Z" fill={look.topColor} />
          <path d="M42 72 L50 82 L58 72 L54 100 L46 100Z" fill="#ffffff" opacity="0.9" />
          {/* face */}
          <circle cx="50" cy="46" r="24" fill={skin} />
          {look.earrings ? (<><circle cx="25.5" cy="52" r="2.2" fill="#f59e0b" /><circle cx="74.5" cy="52" r="2.2" fill="#f59e0b" /></>) : null}
          {/* hair */}
          {style === "bun" ? (<><circle cx="50" cy="18" r="8" fill={hair} /><path d="M26 46 C24 24 36 16 50 16 C64 16 76 24 74 46 C70 32 62 27 50 27 C38 27 30 32 26 46Z" fill={hair} /></>) : null}
          {style === "cap" ? <path d="M25 44 C26 22 38 15 50 15 C62 15 74 22 75 44 C68 30 60 26 50 26 C40 26 32 30 25 44Z" fill={hair} /> : null}
          {style === "side" ? <path d="M25 48 C22 20 40 14 52 15 C68 16 76 26 74 44 C70 30 58 24 46 27 C36 29 29 36 25 48Z" fill={hair} /> : null}
          {style === "short" ? <path d="M27 42 C28 24 38 17 50 17 C62 17 72 24 73 42 C66 31 59 28 50 28 C41 28 34 31 27 42Z" fill={hair} /> : null}
          {/* eyes (blink via .avatar-eyes) */}
          <g className="avatar-eyes" fill="#16163a">
            <ellipse cx="41" cy="46" rx="2.6" ry="3.4" />
            <ellipse cx="59" cy="46" rx="2.6" ry="3.4" />
          </g>
          {/* brows */}
          <path d="M36 39 Q41 36.5 46 39 M54 39 Q59 36.5 64 39" stroke="#16163a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          {/* nose + mouth (mouth animates while speaking) */}
          <path d="M50 49 Q48 55 51 56" stroke="#16163a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {speaking
            ? <ellipse className="avatar-mouth-talk" cx="50" cy="62" rx="5.4" ry="4.6" fill="#7c2d12" />
            : <path d="M44 61 Q50 66 56 61" stroke="#16163a" strokeWidth="2" fill="none" strokeLinecap="round" />}
          {glasses ? (
            <g stroke="#16163a" strokeWidth="1.8" fill="none">
              <rect x="31" y="40" width="17" height="13" rx="5" />
              <rect x="52" y="40" width="17" height="13" rx="5" />
              <path d="M48 45 Q50 43 52 45" />
            </g>
          ) : null}
          {/* cheeks */}
          <circle cx="35" cy="57" r="3.4" fill="#f59e0b" opacity="0.35" />
          <circle cx="65" cy="57" r="3.4" fill="#f59e0b" opacity="0.35" />
        </svg>
        {speaking ? <span aria-hidden="true" className="avatar-eq"><i /><i /><i /></span> : null}
      </span>
      <span className={`max-w-24 truncate rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${speaking ? "bg-flame text-night" : "bg-night/70 text-paper"}`}>
        {speaking ? `${name} · speaking` : name}
      </span>
    </div>
  );
}
