"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../components/Icon";
import { Logo } from "../../components/Logo";
import { BTN_FLAME } from "../../components/GetStarted";
import { LanguageToggle, pick, useLang } from "../../lib/i18n";
import { EDUCATION_LABEL, getProfile, saveProfile, type EducationLevel } from "../../lib/profile";

const LEVELS: EducationLevel[] = ["school", "college", "university"];
const LEVEL_ICON = { school: "book", college: "cap", university: "compass" } as const;
const LEVEL_SUB: Record<EducationLevel, { en: string; bn: string }> = {
  school: { en: "Class 6–10", bn: "ষষ্ঠ–দশম শ্রেণি" },
  college: { en: "Class 11–12", bn: "একাদশ–দ্বাদশ শ্রেণি" },
  university: { en: "Degree & beyond", bn: "ডিগ্রি ও তার উপরে" },
};

export default function OnboardingPage() {
  const { lang } = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [education, setEducation] = useState<EducationLevel | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const edit = new URLSearchParams(window.location.search).get("edit") === "1";
      const existing = getProfile();
      if (existing && !edit) {
        router.replace("/dashboard");
        return;
      }
      if (existing && edit) {
        setName(existing.name);
        setDob(existing.dob);
        setEducation(existing.education);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  const steps = [
    pick(lang, "Your name", "তোমার নাম"),
    pick(lang, "Date of birth", "জন্ম তারিখ"),
    pick(lang, "Education level", "শিক্ষার স্তর"),
  ];

  function next() {
    if (step === 0 && name.trim().length < 2) return setError(pick(lang, "Please write your name.", "তোমার নাম লেখো।"));
    if (step === 1 && !dob) return setError(pick(lang, "Please pick your date of birth.", "জন্ম তারিখ বেছে নাও।"));
    if (step === 1 && new Date(dob) > new Date()) return setError(pick(lang, "Date of birth cannot be in the future.", "জন্ম তারিখ ভবিষ্যতের হতে পারে না।"));
    if (step === 2 && !education) return setError(pick(lang, "Please choose your education level.", "শিক্ষার স্তর বেছে নাও।"));
    setError("");
    if (step < 2) return setStep(step + 1);
    saveProfile({ name: name.trim(), dob, education: education as EducationLevel });
    router.push("/dashboard");
  }

  return (
    <div className="relative min-h-dvh overflow-hidden px-4 py-6 sm:px-6">
      <div aria-hidden="true" className="texture-grid pointer-events-none absolute inset-0 opacity-60" />
      <header className="relative mx-auto flex w-full max-w-3xl items-center justify-between">
        <Logo />
        <LanguageToggle />
      </header>

      <main className="relative mx-auto mt-8 w-full max-w-xl sm:mt-12">
        <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-hard sm:p-7">
          <p className="text-center text-[0.8rem] font-bold tracking-wide text-ember-ink uppercase">
            {pick(lang, "Welcome to Kupi", "কুপিতে স্বাগতম")} · {step + 1} / 3
          </p>
          <h1 className="mt-2 text-center text-[clamp(1.5rem,4vw,2rem)] leading-tight text-ink">
            {pick(lang, "Let's set up your learning", "তোমার শেখাটা সাজিয়ে নিই")}
          </h1>
          <p className="mt-1 text-center text-sm text-ink-soft">
            {pick(lang, "No login, no password — this stays on your device.", "লগইন বা পাসওয়ার্ড নেই — এটা তোমার ডিভাইসেই থাকে।")}
          </p>

          <ol className="mt-6 flex items-center gap-2" aria-label={pick(lang, "Progress", "অগ্রগতি")}>
            {steps.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-sm font-bold ${i <= step ? "bg-flame text-night" : "bg-white text-ink-muted"}`}>
                  {i < step ? <Icon name="check" className="size-4" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className={`hidden text-[0.78rem] font-semibold sm:block ${i === step ? "text-ink" : "text-ink-muted"}`}>{s}</span>
                {i < 2 ? <span className="h-0.5 flex-1 rounded bg-paper-edge" /> : null}
              </li>
            ))}
          </ol>

          <div className="mt-7" key={step}>
            {step === 0 && (
              <div>
                <label htmlFor="ob-name" className="font-display text-lg font-bold text-ink">{pick(lang, "What should we call you?", "তোমাকে কী নামে ডাকব?")}</label>
                <input
                  id="ob-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder={pick(lang, "e.g. Rafi", "যেমন: রাফি")}
                  className="mt-3 h-12 w-full rounded-xl border-2 border-ink bg-paper px-4 text-base text-ink outline-none placeholder:text-ink-muted focus:bg-white"
                />
              </div>
            )}
            {step === 1 && (
              <div>
                <label htmlFor="ob-dob" className="font-display text-lg font-bold text-ink">{pick(lang, "When were you born?", "তোমার জন্ম কবে?")}</label>
                <input
                  id="ob-dob"
                  type="date"
                  autoFocus
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-3 h-12 w-full rounded-xl border-2 border-ink bg-paper px-4 text-base text-ink outline-none focus:bg-white"
                />
                <p className="mt-2 text-[0.82rem] text-ink-muted">{pick(lang, "This helps your AI teacher explain at the right level.", "এটা তোমার AI শিক্ষককে ঠিক স্তরে বোঝাতে সাহায্য করে।")}</p>
              </div>
            )}
            {step === 2 && (
              <fieldset>
                <legend className="font-display text-lg font-bold text-ink">{pick(lang, "Where are you studying?", "তুমি কোথায় পড়ো?")}</legend>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      aria-pressed={education === lv}
                      onClick={() => setEducation(lv)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 border-ink p-4 text-center transition-[transform,box-shadow,background-color] ${education === lv ? "bg-marigold-soft shadow-hard-sm -translate-y-0.5" : "bg-white hover:bg-paper"}`}
                    >
                      <Icon name={LEVEL_ICON[lv]} className="size-7 text-brand-600" strokeWidth={1.8} />
                      <span className="font-display text-base font-bold text-ink">{pick(lang, EDUCATION_LABEL[lv].en, EDUCATION_LABEL[lv].bn)}</span>
                      <span className="text-[0.75rem] text-ink-muted">{pick(lang, LEVEL_SUB[lv].en, LEVEL_SUB[lv].bn)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {error ? <p role="alert" className="mt-4 rounded-xl border border-coral/40 bg-coral-soft px-3 py-2 text-sm font-medium text-shapla-ink">{error}</p> : null}

          <div className="mt-7 flex items-center gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => { setError(""); setStep(step - 1); }} className="h-11 rounded-full border-2 border-ink bg-white px-5 text-sm font-semibold text-ink shadow-hard-sm hover:bg-paper active:translate-y-0.5 active:shadow-none">
                {pick(lang, "Back", "পেছনে")}
              </button>
            ) : null}
            <button type="button" onClick={next} className={`group/btn ${BTN_FLAME} h-11 flex-1 px-5 text-[0.95rem]`}>
              {step === 2 ? pick(lang, "Start Learning", "শেখা শুরু করো") : pick(lang, "Continue", "এগিয়ে যাও")}
              <Icon name="arrow" className="size-5 transition-transform group-hover/btn:translate-x-1" strokeWidth={2} />
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-[0.8rem] text-ink-muted">
          {pick(lang, "Returning user? If you already finished this once on this device, Get Started takes you straight to your dashboard.", "আগে শেষ করেছ? এই ডিভাইসে একবার শেষ করলেই Get Started সরাসরি ড্যাশবোর্ডে নিয়ে যাবে।")}
        </p>
      </main>
    </div>
  );
}
