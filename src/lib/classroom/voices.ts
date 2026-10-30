/**
 * Unique browser voice for every AI teacher and classmate.
 *
 * Meta's API has no TTS model on this account, so speech is the browser's
 * speechSynthesis — but every character gets a distinct profile: a
 * preferred voice family (matched against the device's installed English
 * voices by keyword), plus their own pitch and speaking rate, tuned to
 * their personality so conversations sound like different people.
 */

export type Gender = "male" | "female";

export interface VoiceProfile {
  gender: Gender;
  /** Keywords tried in order against installed voice names (case-insensitive). */
  voiceHints: string[];
  pitch: number; // 0–2, 1 is normal
  rate: number; // multiplier on the class speed
  label: string;
}

const PROFILES: Record<string, VoiceProfile> = {
  // Teachers
  rakib: { gender: "male", voiceHints: ["male", "david", "daniel", "google uk english male"], pitch: 1.05, rate: 1.08, label: "Energetic male · warm, storytelling" },
  nasrin: { gender: "female", voiceHints: ["female", "zira", "samantha", "google uk english female"], pitch: 1.15, rate: 0.88, label: "Calm female · soft, patient" },
  arif: { gender: "male", voiceHints: ["male", "daniel", "david", "microsoft guy"], pitch: 0.9, rate: 1.0, label: "Clear male · steady, direct" },
  farhana: { gender: "female", voiceHints: ["female", "samantha", "zira", "microsoft aria"], pitch: 1.25, rate: 0.97, label: "Warm female · bright, visual" },
  // Classmates
  tamim: { gender: "male", voiceHints: ["male", "junior", "david"], pitch: 1.12, rate: 1.14, label: "Curious boy · quick questions" },
  nabil: { gender: "male", voiceHints: ["male", "daniel"], pitch: 1.1, rate: 0.85, label: "Gentle boy · slower, unsure" },
  mim: { gender: "female", voiceHints: ["female", "zira"], pitch: 1.35, rate: 1.05, label: "Smart girl · confident, clear" },
  priya: { gender: "female", voiceHints: ["female", "samantha"], pitch: 1.2, rate: 0.95, label: "Careful girl · thoughtful" },
  sakib: { gender: "male", voiceHints: ["male", "microsoft guy"], pitch: 1.0, rate: 0.98, label: "Methodical boy · even pace" },
  nabila: { gender: "female", voiceHints: ["female", "microsoft aria"], pitch: 1.45, rate: 1.15, label: "Playful girl · cheerful, fast" },
  hridoy: { gender: "male", voiceHints: ["male", "david"], pitch: 0.95, rate: 0.82, label: "Quiet boy · slow thinker" },
  sumaiya: { gender: "female", voiceHints: ["female", "google uk english female"], pitch: 1.3, rate: 1.0, label: "Encouraging girl · friendly" },
};

const FALLBACK: VoiceProfile = { gender: "female", voiceHints: ["english"], pitch: 1.1, rate: 0.95, label: "Friendly classroom voice" };

/** Well-known device voice names by gender (browser voices carry no gender flag). */
export const MALE_VOICE_NAMES = ["david", "daniel", "guy", "christopher", "eric", "male", "george", "ryan", "brian"];
export const FEMALE_VOICE_NAMES = ["zira", "samantha", "aria", "jenny", "female", "victoria", "kate", "serena", "allison", "ava"];

/** Pick an installed English voice matching the character's gender first. */
export function pickVoiceForProfile(profile: VoiceProfile, voices: { name: string; lang: string }[], seedKey = ""): { name: string; lang: string } | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (!en.length) return undefined;
  const genderNames = profile.gender === "male" ? MALE_VOICE_NAMES : FEMALE_VOICE_NAMES;
  const otherNames = profile.gender === "male" ? FEMALE_VOICE_NAMES : MALE_VOICE_NAMES;
  const byHint = profile.voiceHints.map((h) => en.find((v) => v.name.toLowerCase().includes(h))).find(Boolean);
  if (byHint && !otherNames.some((n) => byHint.name.toLowerCase().includes(n))) return byHint;
  const gendered = en.find((v) => genderNames.some((n) => v.name.toLowerCase().includes(n)));
  if (gendered) return gendered;
  const neutral = en.find((v) => !otherNames.some((n) => v.name.toLowerCase().includes(n)));
  if (neutral) return neutral;
  // Last resort: any English voice; pitch still separates male/female characters.
  const seed = [...seedKey].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return en[seed % en.length];
}

/** Profile by character id or display name ("Rakib Sir", "Tamim", …). */
export function voiceProfileFor(nameOrId: string): VoiceProfile {
  const key = nameOrId.toLowerCase().replace(/[^a-z]/g, "");
  // Longest id first: "nabila" must match Nabila, not the shorter "nabil".
  const entries = Object.entries(PROFILES).sort((a, b) => b[0].length - a[0].length);
  for (const [id, profile] of entries) {
    if (key === id || key.startsWith(id) || key.includes(id)) return profile;
  }
  if (key.includes("sir") || key.includes("rakib")) return PROFILES.rakib!;
  if (key.includes("maam") || key.includes("mam") || key.includes("nasrin") || key.includes("farhana")) return PROFILES.farhana!;
  return FALLBACK;
}

export function allVoiceProfiles(): { id: string; profile: VoiceProfile }[] {
  return Object.entries(PROFILES).map(([id, profile]) => ({ id, profile }));
}

/**
 * Speak as a character (browser TTS). Picks that character's installed
 * voice when available, then applies their pitch/rate. `speed` is the
 * student's Class Speed multiplier.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesPrimed = false;

/**
 * Browser voices load asynchronously: getVoices() is often empty until
 * `voiceschanged` fires. Prime the cache early (e.g. on Start Class) so
 * the first lines already use each character's gender-matched voice
 * instead of the device default for everyone.
 */
export function primeVoices(): void {
  try {
    if (!("speechSynthesis" in window) || voicesPrimed) return;
    voicesPrimed = true;
    const load = () => { cachedVoices = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
  } catch { /* speech is optional */ }
}

function currentVoices(): SpeechSynthesisVoice[] {
  try {
    const live = window.speechSynthesis.getVoices();
    if (live.length) cachedVoices = live;
  } catch { /* noop */ }
  return cachedVoices;
}

export function speakAsCharacter(nameOrId: string, text: string, speed = 1): void {
  try {
    if (!("speechSynthesis" in window)) return;
    primeVoices();
    const profile = voiceProfileFor(nameOrId);
    const speakNow = () => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 280));
      u.lang = "en-US";
      const picked = pickVoiceForProfile(profile, currentVoices(), nameOrId);
      const match = picked ? currentVoices().find((v) => v.name === picked.name) : undefined;
      if (match) u.voice = match;
      u.pitch = Math.max(0, Math.min(2, profile.pitch));
      u.rate = Math.max(0.5, Math.min(1.8, profile.rate * speed));
      window.speechSynthesis.speak(u);
    };
    if (currentVoices().length) {
      speakNow();
    } else {
      // Voices not loaded yet: wait briefly for voiceschanged, then speak
      // with the right voice rather than the default for everyone.
      let done = false;
      const go = () => { if (!done) { done = true; speakNow(); } };
      window.speechSynthesis.addEventListener?.("voiceschanged", go, { once: true });
      setTimeout(go, 700);
    }
  } catch { /* speech is optional */ }
}
