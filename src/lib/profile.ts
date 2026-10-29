export type EducationLevel = "school" | "college" | "university";

export type Profile = {
  name: string;
  dob: string; // ISO yyyy-mm-dd
  education: EducationLevel;
  createdAt: string;
};

const KEY = "kupi-profile";

export function getProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p.name || !p.dob || !["school", "college", "university"].includes(p.education)) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(p: Omit<Profile, "createdAt">): Profile {
  const profile: Profile = { ...p, createdAt: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export function clearProfile() {
  window.localStorage.removeItem(KEY);
}

/** Where "Get Started" should go: returning users straight to the dashboard. */
export function getStartedHref(): string {
  return getProfile() ? "/dashboard" : "/onboarding";
}

export const EDUCATION_LABEL: Record<EducationLevel, { en: string; bn: string }> = {
  school: { en: "School", bn: "স্কুল" },
  college: { en: "College", bn: "কলেজ" },
  university: { en: "University", bn: "বিশ্ববিদ্যালয়" },
};
