"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "../Icon";
import { pick, useLang, type Lang } from "../../lib/i18n";
import { EDUCATION_LABEL, getProfile } from "../../lib/profile";
import { GAMES, HOMEWORK, PRACTICE_QS, REVISION, SUBJECTS, bi, type Bi } from "../../lib/dashboard-data";
import type { DashSection } from "./DashboardShell";
import { ClassroomFlow } from "../classroom/ClassroomFlow";

const t = (lang: Lang, v: Bi) => (lang === "bn" ? v.bn : v.en);
const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN_SM = "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none";

function useGreeting(lang: Lang) {
  // Defer the clock read to the client: reading Date during prerender
  // blocks static rendering (Next 16 instant navigation).
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHour(new Date().getHours()));
    return () => cancelAnimationFrame(id);
  }, []);
  if (hour === null) return pick(lang, "Welcome", "\u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae");
  if (hour < 12) return pick(lang, "Good morning", "\u09b6\u09c1\u09ad \u09b8\u0995\u09be\u09b2");
  if (hour < 17) return pick(lang, "Good afternoon", "\u09b6\u09c1\u09ad \u09a6\u09c1\u09aa\u09c1\u09b0");
  return pick(lang, "Good evening", "\u09b6\u09c1\u09ad \u09b8\u09a8\u09cd\u09a7\u09cd\u09af\u09be");
}

function useName() {
  const [name, setName] = useState("");
  const [edu, setEdu] = useState("");
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = getProfile();
      if (p) { setName(p.name); setEdu(p.education); }
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return { name, edu };
}

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-[clamp(1.35rem,3vw,1.8rem)] leading-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{sub}</p>
    </div>
  );
}

function SubjectsGrid() {
  const { lang } = useLang();
  return (
    <ul className="grid grid-cols-3 gap-x-2.5 gap-y-3 min-[480px]:grid-cols-6 sm:gap-x-3.5">
      {SUBJECTS.map((s) => (
        <li key={s.id}>
          <Link href="/dashboard/lesson" aria-label={t(lang, s.title)} className="group relative block text-left">
            <span className="relative block overflow-hidden rounded-[0.35rem_0.9rem_0.9rem_0.35rem] border-2 border-ink shadow-hard-sm transition-transform duration-200 group-hover:-translate-y-1">
              <Image src={s.cover} alt={t(lang, s.title)} width={300} height={380} className={`aspect-[3/4] w-full object-cover ${s.live ? "" : "opacity-80 saturate-50"}`} />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 border-t-2 border-ink bg-night/85 px-1 py-1 text-[0.6rem] font-semibold text-white">
                <Icon name="flame" className="size-3 text-flame" strokeWidth={2} />
                {pick(lang, "Kupi School", "কুপি পাঠশালা")}
              </span>
            </span>
            <span className="mt-1.5 block truncate text-center text-[0.8rem] font-bold text-ink">{t(lang, s.title)}</span>
            <span className={`block text-center text-[0.68rem] font-semibold ${s.live ? "text-kolapata" : "text-ink-muted"}`}>{s.live ? pick(lang, "Live now", "চালু আছে") : pick(lang, "Coming soon", "শীঘ্রই আসছে")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HomeView() {
  const { lang } = useLang();
  const { name, edu } = useName();
  const eduLabel = edu ? pick(lang, EDUCATION_LABEL[edu as keyof typeof EDUCATION_LABEL].en, EDUCATION_LABEL[edu as keyof typeof EDUCATION_LABEL].bn) : "";
  return (
    <div className="mx-auto grid max-w-[84rem] gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <section aria-labelledby="greeting" className="relative isolate overflow-hidden rounded-2xl border-2 border-ink bg-sand px-3 py-2.5 shadow-hard-sm sm:px-4">
          <div aria-hidden="true" className="texture-grid absolute inset-0 -z-10 opacity-60" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-flame font-display text-[1.15rem] font-bold text-night">{(name || "K").charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <h1 id="greeting" className="truncate text-[1.2rem] leading-tight text-ink sm:text-[1.35rem]">{useGreeting(lang)}, {name || pick(lang, "Learner", "শিক্ষার্থী")}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.8rem] leading-snug text-ink-soft">
                  {eduLabel ? <span className="font-semibold text-ink">{eduLabel}</span> : null}
                  <span aria-hidden="true">·</span><span>{pick(lang, "Ready to learn today?", "আজ শেখার জন্য তৈরি?")}</span>
                </p>
              </div>
            </div>
            <Link href="/dashboard/lesson" className={BTN_SM}>{pick(lang, "Continue Lesson", "লেসন চালিয়ে যাও")}<Icon name="arrow" className="size-4" strokeWidth={2.2} /></Link>
          </div>
        </section>

        <section aria-labelledby="subjects-box" className={`${CARD} overflow-hidden`}>
          <header className="flex items-center gap-2.5 border-b-2 border-dashed border-paper-edge px-3 py-2 sm:px-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand text-ember"><Icon name="book" className="size-5" strokeWidth={1.9} /></span>
            <div className="min-w-0 flex-1">
              <h2 id="subjects-box" className="text-[1.05rem] leading-tight text-ink">{pick(lang, "My Subjects", "আমার বিষয়সমূহ")}</h2>
              <p className="mt-0.5 text-[0.85rem] text-ink-muted">{pick(lang, "Pick a subject — then a chapter and topic.", "একটি বিষয় বেছে নাও — তারপর অধ্যায় আর টপিক।")}</p>
            </div>
          </header>
          <div className="mx-auto max-w-[44rem] px-3 pt-2.5 pb-3 sm:px-4"><SubjectsGrid /></div>
        </section>

        <section aria-labelledby="games-box" className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="games-box" className="text-[1.05rem] text-ink">{pick(lang, "Learn by Playing", "খেলতে খেলতে শেখো")}</h2>
            <Link href="/dashboard/games" className="text-sm font-bold text-brand-700 underline decoration-flame decoration-2 underline-offset-4">{pick(lang, "All games", "সব গেম")}</Link>
          </div>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {GAMES.slice(0, 3).map((g) => (
              <li key={g.title.en}>
                <Link href="/dashboard/games" className="flex h-full flex-col gap-1.5 rounded-xl border border-paper-edge bg-paper p-3 transition-transform hover:-translate-y-0.5">
                  <span className={`grid size-9 place-items-center rounded-lg border-2 border-ink ${g.chip}`}><Icon name={g.icon} className="size-4.5" strokeWidth={1.8} /></span>
                  <span className="font-display text-[0.95rem] font-bold text-ink">{t(lang, g.title)}</span>
                  <span className="text-[0.8rem] text-ink-soft">{t(lang, g.body)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-3">
        <section className={`${CARD} p-4`}>
          <h2 className="flex items-center gap-2 text-[1rem] text-ink"><Icon name="flame" className="size-5 text-ember" strokeWidth={1.8} />{pick(lang, "Today", "আজ")}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li><Link href="/dashboard/homework" className="flex justify-between gap-2 rounded-lg bg-marigold-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Homework due", "হোমওয়ার্ক বাকি")}</span><span>{HOMEWORK.length}</span></Link></li>
            <li><Link href="/dashboard/revision" className="flex justify-between gap-2 rounded-lg bg-lagoon-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Revision cards", "রিভিশন কার্ড")}</span><span>8</span></Link></li>
            <li><Link href="/dashboard/practice" className="flex justify-between gap-2 rounded-lg bg-coral-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Practice questions", "অনুশীলন প্রশ্ন")}</span><span>{PRACTICE_QS.length}</span></Link></li>
          </ul>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-board p-4 text-paper shadow-hard-sm">
          <h2 className="text-[1rem]">{pick(lang, "Be the Teacher", "আমি শিক্ষক হবো")}</h2>
          <p className="mt-1 text-[0.85rem] leading-relaxed text-brand-100/70">{pick(lang, "Teach your AI classmates — the best way to check you really understood.", "AI সহপাঠীদের পড়াও — সত্যিই বুঝেছ কিনা যাচাইয়ের সেরা উপায়।")}</p>
          <Link href="/dashboard/learn" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-flame px-4 py-2 text-sm font-bold text-night">{pick(lang, "Start teaching", "পড়ানো শুরু করো")}<Icon name="arrow" className="size-4" strokeWidth={2.2} /></Link>
        </section>
      </aside>
    </div>
  );
}

function LessonView() {
  return <ClassroomFlow />;
}

function RevisionView() {
  const { lang } = useLang();
  const [done, setDone] = useState<boolean[]>(REVISION.map(() => false));
  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Revision", "রিভিশন")} sub={pick(lang, "Your revision plan — little and often, so the light stays on after 7 days too.", "তোমার রিভিশনের পরিকল্পনা — অল্প অল্প করে, যাতে ৭ দিন পরেও আলোটা জ্বলে থাকে।")} />
      <ul className="grid gap-3 lg:grid-cols-3">
        {REVISION.map((r, i) => (
          <li key={r.title.en} className={`${CARD} flex flex-col gap-2 p-4 ${done[i] ? "opacity-70" : ""}`}>
            <span className="grid size-9 place-items-center rounded-lg bg-lagoon-soft text-padma-ink"><Icon name="refresh" className="size-4.5" strokeWidth={1.9} /></span>
            <h2 className="font-display text-lg leading-snug font-bold text-ink">{t(lang, r.title)}</h2>
            <p className="text-[0.85rem] text-ink-muted">{t(lang, r.meta)}</p>
            <button type="button" aria-pressed={done[i]} onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))} className={`${BTN_SM} mt-auto self-start`}>
              <Icon name="check" className="size-4" strokeWidth={2.4} />{done[i] ? pick(lang, "Revised", "রিভিশন হয়েছে") : pick(lang, "Mark revised", "রিভিশন হয়েছে বলো")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticeView() {
  const { lang } = useLang();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = PRACTICE_QS[idx];

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  }
  function nextQ() {
    setPicked(null);
    if (idx + 1 >= PRACTICE_QS.length) setFinished(true);
    else setIdx(idx + 1);
  }
  if (finished) {
    return (
      <div className={`mx-auto max-w-xl ${CARD} p-6 text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full border-2 border-ink bg-flame text-night"><Icon name="check" className="size-7" strokeWidth={2.4} /></span>
        <h1 className="mt-3 text-2xl text-ink">{pick(lang, "Practice complete!", "অনুশীলন শেষ!")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, `You got ${score} of ${PRACTICE_QS.length} right.`, `তুমি ${PRACTICE_QS.length}টির মধ্যে ${score}টি সঠিক করেছ।`)}</p>
        <button type="button" className={`${BTN_SM} mt-4`} onClick={() => { setIdx(0); setScore(0); setPicked(null); setFinished(false); }}>{pick(lang, "Practice again", "আবার অনুশীলন করো")}</button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Practice", "অনুশীলন")} sub={pick(lang, "Hints first, answers later — try it yourself first.", "আগে হিন্ট, পরে উত্তর — আগে নিজে চেষ্টা করো।")} />
      <section className={`${CARD} mx-auto max-w-2xl p-5`}>
        <p className="text-[0.8rem] font-bold text-ink-muted">{pick(lang, `Question ${idx + 1} of ${PRACTICE_QS.length}`, `প্রশ্ন ${idx + 1} / ${PRACTICE_QS.length}`)} · {pick(lang, "Score", "স্কোর")}: {score}</p>
        <h2 className="mt-2 font-display text-xl font-bold text-ink">{t(lang, q.q)}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {q.options.map((op, i) => {
            const isRight = picked !== null && i === q.answer;
            const isWrong = picked === i && i !== q.answer;
            return (
              <li key={op}>
                <button type="button" onClick={() => choose(i)} className={`w-full rounded-xl border-2 border-ink px-4 py-3 text-left font-semibold text-ink transition-colors ${isRight ? "bg-kolapata-soft" : isWrong ? "bg-coral-soft" : "bg-paper hover:bg-white"}`}>{op}</button>
              </li>
            );
          })}
        </ul>
        {picked !== null ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className={`text-sm font-bold ${picked === q.answer ? "text-kolapata" : "text-shapla-ink"}`}>{picked === q.answer ? pick(lang, "Correct — the light is on!", "সঠিক — আলো জ্বলে গেছে!") : pick(lang, "Not quite — the right answer is highlighted.", "হয়নি — সঠিক উত্তরটা দেখিয়ে দেওয়া হয়েছে।")}</p>
            <button type="button" onClick={nextQ} className={BTN_SM}>{idx + 1 >= PRACTICE_QS.length ? pick(lang, "See result", "ফলাফল দেখো") : pick(lang, "Next question", "পরের প্রশ্ন")}<Icon name="arrow" className="size-4" strokeWidth={2.2} /></button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function HomeworkView() {
  const { lang } = useLang();
  const [done, setDone] = useState<boolean[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("kupi-homework") ?? "[]") as boolean[]; } catch { return []; }
  });
  const toggle = (i: number) => setDone((d) => {
    const next = HOMEWORK.map((_, j) => (j === i ? !(d[j] ?? false) : (d[j] ?? false)));
    window.localStorage.setItem("kupi-homework", JSON.stringify(next));
    return next;
  });
  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Homework", "হোমওয়ার্ক")} sub={pick(lang, "Tonight's work — tick each one off as you finish. Stuck? Ask your AI teacher.", "আজকের কাজ — শেষ হলেই টিক দাও। আটকে গেলে AI শিক্ষককে জিজ্ঞেস করো।")} />
      <ul className="grid gap-3 lg:grid-cols-3">
        {HOMEWORK.map((h, i) => (
          <li key={h.title.en} className={`${CARD} flex flex-col gap-2 p-4 ${done[i] ? "opacity-70" : ""}`}>
            <span className="grid size-9 place-items-center rounded-lg bg-marigold-soft text-ember-ink"><Icon name="notes" className="size-4.5" strokeWidth={1.9} /></span>
            <h2 className="font-display text-lg leading-snug font-bold text-ink">{t(lang, h.title)}</h2>
            <p className="text-[0.85rem] text-ink-muted">{t(lang, h.meta)}</p>
            <button type="button" aria-pressed={!!done[i]} onClick={() => toggle(i)} className={`${BTN_SM} mt-auto self-start`}><Icon name="check" className="size-4" strokeWidth={2.4} />{done[i] ? pick(lang, "Done", "শেষ হয়েছে") : pick(lang, "Mark done", "শেষ হয়েছে বলো")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GamesView() {
  const { lang } = useLang();
  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Games", "গেমস")} sub={pick(lang, "Learn by playing — every game is built from what you are studying.", "খেলতে খেলতে শেখো — প্রতিটি গেম তোমার পড়া থেকেই বানানো।")} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <li key={g.title.en} className={`${CARD} flex flex-col gap-2 p-4`}>
            <span className={`grid size-10 place-items-center rounded-xl border-2 border-ink ${g.chip}`}><Icon name={g.icon} className="size-5" strokeWidth={1.8} /></span>
            <h2 className="font-display text-lg leading-snug font-bold text-ink">{t(lang, g.title)}</h2>
            <p className="text-[0.88rem] text-ink-soft">{t(lang, g.body)}</p>
            <Link href="/dashboard/practice" className={`${BTN_SM} mt-auto self-start`}><Icon name="play" className="size-4" />{pick(lang, "Play", "খেলো")}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimpleView({ section }: { section: DashSection }) {
  const { lang } = useLang();
  const { name, edu } = useName();
  const copy: Record<string, { title: Bi; sub: Bi }> = {
    subjects: { title: bi("Subjects", "বিষয়সমূহ"), sub: bi("Every subject, chapter by chapter.", "সব বিষয়, অধ্যায় ধরে ধরে।") },
    progress: { title: bi("Progress", "অগ্রগতি"), sub: bi("What you have learned, and what is next.", "যা যা শিখেছ, আর এরপর কী।") },
    profile: { title: bi("Profile", "প্রোফাইল"), sub: bi("Your name and learning level, saved on this device.", "তোমার নাম ও শিক্ষার স্তর, এই ডিভাইসে সংরক্ষিত।") },
    subscription: { title: bi("Subscription", "সাবস্ক্রিপশন"), sub: bi("Free ৳0 — Premium coming soon.", "ফ্রি ৳০ — প্রিমিয়াম শীঘ্রই আসছে।") },
    learn: { title: bi("Learn Anything", "যেকোনো প্রশ্ন নিয়ে শেখো"), sub: bi("Ask any question — your AI teacher explains it on the board.", "যেকোনো প্রশ্ন করো — AI শিক্ষক বোর্ডে বুঝিয়ে দেবে।") },
    offline: { title: bi("Download & Offline", "ডাউনলোড ও অফলাইন"), sub: bi("Install Kupi like an app and keep learning without internet.", "কুপিকে অ্যাপের মতো ইনস্টল করো, ইন্টারনেট ছাড়াও শেখো।") },
    help: { title: bi("Help & Report", "সাহায্য ও রিপোর্ট"), sub: bi("Frequently asked questions and support.", "সচরাচর প্রশ্ন ও সাহায্য।") },
  };
  const c = copy[section] ?? copy.subjects;
  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={t(lang, c.title)} sub={t(lang, c.sub)} />
      {section === "subjects" ? <section className={`${CARD} p-4`}><div className="mx-auto max-w-[44rem]"><SubjectsGrid /></div></section> : null}
      {section === "profile" ? (
        <section className={`${CARD} max-w-xl p-5`}>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full border-2 border-ink bg-flame font-display text-xl font-bold text-night">{(name || "K").charAt(0).toUpperCase()}</span>
            <div><h2 className="font-display text-xl font-bold text-ink">{name}</h2><p className="text-sm text-ink-muted">{edu ? t(lang, EDUCATION_LABEL[edu as keyof typeof EDUCATION_LABEL]) : ""}</p></div>
          </div>
          <Link href="/onboarding?edit=1" className={`${BTN_SM} mt-4`}>{pick(lang, "Update profile", "প্রোফাইল বদলাও")}</Link>
        </section>
      ) : null}
      {section === "progress" ? (
        <section className={`${CARD} max-w-xl p-5`}>
          <h2 className="font-display text-lg font-bold text-ink">{pick(lang, "This week", "এই সপ্তাহ")}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
            <li className="flex justify-between rounded-lg bg-paper px-3 py-2"><span>{pick(lang, "Lessons completed", "লেসন শেষ হয়েছে")}</span><strong className="text-ink">2</strong></li>
            <li className="flex justify-between rounded-lg bg-paper px-3 py-2"><span>{pick(lang, "Practice score", "অনুশীলনের স্কোর")}</span><strong className="text-ink">—</strong></li>
            <li className="flex justify-between rounded-lg bg-paper px-3 py-2"><span>{pick(lang, "Homework done", "হোমওয়ার্ক শেষ")}</span><strong className="text-ink">—</strong></li>
          </ul>
        </section>
      ) : null}
      {!["subjects", "profile", "progress"].includes(section) ? (
        <section className={`${CARD} max-w-xl p-5`}>
          <p className="text-sm leading-relaxed text-ink-soft">{pick(lang, "This part of your dashboard is ready for your content. Use the sidebar — Lesson, Revision, Practice, Homework and Games are fully working.", "ড্যাশবোর্ডের এই অংশ তোমার কনটেন্টের জন্য তৈরি। সাইডবারের লেসন, রিভিশন, অনুশীলন, হোমওয়ার্ক ও গেমস পুরোপুরি কাজ করছে।")}</p>
        </section>
      ) : null}
    </div>
  );
}

export function DashboardView({ section }: { section: DashSection }) {
  switch (section) {
    case "classroom": return <ClassroomFlow />;
    case "lesson": return <LessonView />;
    case "revision": return <RevisionView />;
    case "practice": return <PracticeView />;
    case "homework": return <HomeworkView />;
    case "games": return <GamesView />;
    case "home": return <HomeView />;
    default: return <SimpleView section={section} />;
  }
}
