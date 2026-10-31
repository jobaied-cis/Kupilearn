"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "../Icon";
import { pick, useLang, type Lang } from "../../lib/i18n";
import { EDUCATION_LABEL, getProfile } from "../../lib/profile";
import { GAMES, SUBJECTS, bi, type Bi } from "../../lib/dashboard-data";
import { adaptLearner, recordAnswer, type LearnerProfile } from "../../lib/learner/adapt";
import { loadLearner, saveLearner } from "../../lib/learner/store";
import { getClass } from "../../lib/nctb/catalog";
import {
  buildAdaptivePracticeSet,
  buildBookmarkSet,
  buildMixedPracticeSet,
  buildRetrySet,
  buildReviewPracticeSet,
  gradePracticeSet,
  isCorrectAnswer,
  makePracticeResult,
  paceSetSize,
  summarizePractice,
  type PracticeResult,
  type PracticeSet,
} from "../../lib/practice/engine";
import {
  appendPracticeResult,
  loadBookmarks,
  loadPracticeResults,
  toggleBookmark,
  type Bookmark,
} from "../../lib/practice/store";
import {
  WEEKLY_GOAL_POINTS,
  completionStats,
  dueAtForBucket,
  dueSoonCount,
  generateHomeworkFromTopic,
  generateReviewHomework,
  markDone,
  nextOccurrence,
  overdueCount,
  personaFromLearner,
  pointsThisWeek,
  snoozeAssignment,
  taskProgress,
  toggleTask,
  totalPoints,
  type DueBucket,
  type HomeworkAssignment,
} from "../../lib/homework/engine";
import { addAssignment, loadAssignments, saveAssignments } from "../../lib/homework/store";
import { RevisionDashboard } from "../revision/RevisionDashboard";
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
  const [hwDue, setHwDue] = useState(0);
  const [hwOverdue, setHwOverdue] = useState(0);
  const [practiceSize, setPracticeSize] = useState(5);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const learner = loadLearner();
      const assignments = loadAssignments(learner.classLevel);
      const now = new Date();
      setHwDue(dueSoonCount(assignments, now));
      setHwOverdue(overdueCount(assignments, now));
      setPracticeSize(paceSetSize(learner.pace));
    });
    return () => cancelAnimationFrame(id);
  }, []);
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
            <li><Link href="/dashboard/homework" className="flex justify-between gap-2 rounded-lg bg-marigold-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Homework due", "হোমওয়ার্ক বাকি")}</span><span>{hwDue}</span></Link></li>
            {hwOverdue > 0 ? (
              <li><Link href="/dashboard/homework" className="flex justify-between gap-2 rounded-lg bg-coral-soft px-3 py-2 font-semibold text-shapla-ink"><span>{pick(lang, "Overdue — finish first", "দেরি হয়ে গেছে — আগে এগুলো")}</span><span>{hwOverdue}</span></Link></li>
            ) : null}
            <li><Link href="/dashboard/revision" className="flex justify-between gap-2 rounded-lg bg-lagoon-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Revision cards", "রিভিশন কার্ড")}</span><span>8</span></Link></li>
            <li><Link href="/dashboard/practice" className="flex justify-between gap-2 rounded-lg bg-coral-soft px-3 py-2 font-semibold text-ink"><span>{pick(lang, "Practice questions", "অনুশীলন প্রশ্ন")}</span><span>{practiceSize}</span></Link></li>
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
  return <RevisionDashboard />;
}

const DIFF_LABEL = (lang: Lang, d: 1 | 2 | 3) =>
  d === 1
    ? pick(lang, "Gentle practice", "সহজ অনুশীলন")
    : d === 2
      ? pick(lang, "Steady practice", "নিয়মিত অনুশীলন")
      : pick(lang, "Challenge practice", "চ্যালেঞ্জ অনুশীলন");

function PracticeView() {
  const { lang } = useLang();
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | string | null>(null);
  const [picks, setPicks] = useState<(number | string | null)[]>([]);
  const [typed, setTyped] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [showExample, setShowExample] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hwAdded, setHwAdded] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setLearner(loadLearner());
      setResults(loadPracticeResults());
      setBookmarks(loadBookmarks());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const classLevel = learner?.classLevel ?? 6;
  const catalog = getClass(classLevel);
  const topicOptions =
    catalog?.subjects.flatMap((s) =>
      s.chapters.flatMap((c) => c.topics.map((tp) => ({ subject: s, topic: tp }))),
    ) ?? [];
  const adaptation = learner ? adaptLearner(learner) : null;
  const summary = summarizePractice(results);
  const q = set?.questions[idx];

  function beginSet(next: PracticeSet, nextTopicId: string) {
    setSet(next);
    setTopicId(nextTopicId);
    setIdx(0);
    setPicked(null);
    setPicks([]);
    setTyped("");
    setHintLevel(0);
    setShowExample(false);
    setScore(0);
    setFinished(false);
    setHwAdded(false);
  }

  function updatePersona(patch: Partial<LearnerProfile>) {
    if (!learner) return;
    const next = { ...learner, ...patch, updatedAt: new Date().toISOString() };
    saveLearner(next);
    setLearner(next);
  }

  function startSet(nextTopicId: string) {
    if (!learner) return;
    beginSet(buildAdaptivePracticeSet(learner, nextTopicId, results), nextTopicId);
  }

  function startMixed() {
    if (!learner) return;
    beginSet(buildMixedPracticeSet(learner), "mixed");
  }

  function startReview() {
    if (!learner) return;
    const review = buildReviewPracticeSet(learner, results);
    if (review) beginSet(review, "review");
  }

  function startBookmarks() {
    if (!learner) return;
    const bookmarkSet = buildBookmarkSet(learner, bookmarks.map((b) => b.question));
    if (bookmarkSet) beginSet(bookmarkSet, "bookmarks");
  }

  function startRetry() {
    if (!set) return;
    const retry = buildRetrySet(set, picks);
    if (retry) beginSet(retry, "retry");
  }

  function onToggleBookmark() {
    if (!q) return;
    setBookmarks((current) => toggleBookmark(current, q));
  }

  function choose(pick: number | string) {
    if (!set || !q || picked !== null || !learner) return;
    setPicked(pick);
    const correct = isCorrectAnswer(q, pick);
    if (correct) setScore((s) => s + 1);
    setPicks((p) => {
      const next = [...p];
      next[idx] = pick;
      return next;
    });
    // Every answer is an observable learning signal — it feeds adaptation,
    // revision (mistake topics) and the Progress report.
    const next = recordAnswer(learner, correct, q.topicId);
    saveLearner(next);
    setLearner(next);
  }

  function nextQ() {
    if (!set || !learner) return;
    setPicked(null);
    setTyped("");
    setHintLevel(0);
    setShowExample(false);
    if (idx + 1 >= set.questions.length) {
      const graded = gradePracticeSet(set, picks);
      setResults(appendPracticeResult(makePracticeResult(set, graded.score)));
      setFinished(true);
    } else {
      setIdx(idx + 1);
    }
  }

  function addReviewHomework() {
    if (!learner || !set || hwAdded) return;
    const wrongTopics = set.questions
      .filter((item, i) => !gradePracticeSet(set, picks).correct[i])
      .map((item) => item.topicId);
    const assignment =
      generateReviewHomework(learner.classLevel, [...new Set(wrongTopics)], new Date(), personaFromLearner(learner)) ??
      generateReviewHomework(learner.classLevel, learner.mistakeTopics, new Date(), personaFromLearner(learner));
    if (!assignment) return;
    addAssignment(loadAssignments(learner.classLevel), assignment);
    setHwAdded(true);
  }

  if (!learner) {
    return (
      <div className="mx-auto max-w-[84rem]">
        <PageHead title={pick(lang, "Practice", "অনুশীলন")} sub={pick(lang, "Loading your practice…", "তোমার অনুশীলন লোড হচ্ছে…")} />
      </div>
    );
  }

  if (finished && set) {
    const graded = gradePracticeSet(set, picks);
    return (
      <div className={`mx-auto max-w-2xl ${CARD} p-6`}>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border-2 border-ink bg-flame text-night"><Icon name="check" className="size-7" strokeWidth={2.4} /></span>
          <h1 className="mt-3 text-2xl text-ink">{pick(lang, "Practice complete!", "অনুশীলন শেষ!")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{pick(lang, `You got ${graded.score} of ${set.questions.length} right in ${set.topicTitle}.`, `তুমি ${set.topicTitle}-এ ${set.questions.length}টির মধ্যে ${graded.score}টি সঠিক করেছ।`)}</p>
          <p className="mt-1 text-[0.82rem] font-semibold text-ink-muted">{DIFF_LABEL(lang, set.difficulty)}</p>
        </div>
        <ol className="mt-5 flex flex-col gap-2.5">
          {set.questions.map((item, i) => {
            const yourAnswer =
              item.format === "numeric"
                ? String(picks[i] ?? "—")
                : (typeof picks[i] === "number" ? item.options[picks[i] as number] : undefined) ?? "—";
            return (
              <li key={item.id} className="rounded-xl border border-paper-edge bg-paper p-3">
                <p className="text-sm font-bold text-ink">{i + 1}. {item.question}</p>
                <p className={`mt-1 text-[0.85rem] font-semibold ${graded.correct[i] ? "text-kolapata" : "text-shapla-ink"}`}>
                  {graded.correct[i]
                    ? pick(lang, "Correct", "সঠিক")
                    : pick(lang, `Your answer: ${yourAnswer} · Right answer: ${item.answer}`, `তোমার উত্তর: ${yourAnswer} · সঠিক উত্তর: ${item.answer}`)}
                </p>
                <p className="mt-0.5 text-[0.85rem] text-ink-soft">{item.explanation}</p>
              </li>
            );
          })}
        </ol>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {set.topicId !== "mixed" && set.topicId !== "review" ? (
            <button type="button" className={BTN_SM} onClick={() => startSet(set.topicId)}>{pick(lang, "Practice again", "আবার অনুশীলন করো")}</button>
          ) : null}
          {graded.score < set.questions.length ? (
            <button type="button" className={BTN_SM} onClick={startRetry}>
              <Icon name="refresh" className="size-4" strokeWidth={2} />{pick(lang, `Retry the ${set.questions.length - graded.score} wrong ones`, `ভুল ${set.questions.length - graded.score}টি আবার করো`)}
            </button>
          ) : null}
          {graded.score < set.questions.length && !hwAdded ? (
            <button type="button" className={BTN_SM} onClick={addReviewHomework}>
              <Icon name="notes" className="size-4" strokeWidth={2} />{pick(lang, "Add review homework", "রিভিশন হোমওয়ার্ক যোগ করো")}
            </button>
          ) : null}
          {hwAdded ? (
            <Link href="/dashboard/homework" className={BTN_SM}><Icon name="check" className="size-4" strokeWidth={2.2} />{pick(lang, "Review homework added — view", "রিভিশন হোমওয়ার্ক যোগ হয়েছে — দেখো")}</Link>
          ) : null}
          <button type="button" className={BTN_SM} onClick={() => { setSet(null); setFinished(false); }}>{pick(lang, "Another topic", "অন্য টপিক")}</button>
          <Link href="/dashboard/homework" className={BTN_SM}>{pick(lang, "See homework", "হোমওয়ার্ক দেখো")}<Icon name="arrow" className="size-4" strokeWidth={2.2} /></Link>
        </div>
      </div>
    );
  }

  if (!set || !q) {
    return (
      <div className="mx-auto max-w-[84rem]">
        <PageHead title={pick(lang, "Practice", "অনুশীলন")} sub={pick(lang, "Hints first, answers later — try it yourself first.", "আগে হিন্ট, পরে উত্তর — আগে নিজে চেষ্টা করো।")} />
        <section aria-label={pick(lang, "Your learning style", "তোমার শেখার ধরন")} className={`${CARD} mb-4 flex flex-wrap items-end gap-3 p-4`}>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[1.02rem] font-bold text-ink">{pick(lang, "Practice made for you", "তোমার জন্য তৈরি অনুশীলন")}</h2>
            <p className="text-[0.85rem] text-ink-muted">{pick(lang, "Style adds examples, drawing prompts or step hints; pace sets how many questions.", "ধরন অনুযায়ী উদাহরণ, ছবি আঁকার ইঙ্গিত বা ধাপ-হিন্ট আসে; গতি ঠিক করে কয়টি প্রশ্ন।")}</p>
          </div>
          <label className="flex flex-col gap-1 text-[0.78rem] font-bold text-ink-muted">
            {pick(lang, "I learn best…", "আমি সবচেয়ে ভালো শিখি…")}
            <select value={learner.preferredStyle} onChange={(e) => updatePersona({ preferredStyle: e.target.value as LearnerProfile["preferredStyle"] })} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
              <option value="step-by-step">{pick(lang, "Step by step", "ধাপে ধাপে")}</option>
              <option value="examples-first">{pick(lang, "Examples first", "আগে উদাহরণ")}</option>
              <option value="visual">{pick(lang, "With pictures", "ছবি দিয়ে")}</option>
              <option value="challenge">{pick(lang, "Challenge me", "চ্যালেঞ্জ দাও")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.78rem] font-bold text-ink-muted">
            {pick(lang, "My pace…", "আমার গতি…")}
            <select value={learner.pace} onChange={(e) => updatePersona({ pace: e.target.value as LearnerProfile["pace"] })} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
              <option value="slow">{pick(lang, "Slow & steady (3)", "ধীরে ধীরে (৩)")}</option>
              <option value="steady">{pick(lang, "Steady (5)", "নিয়মিত (৫)")}</option>
              <option value="fast">{pick(lang, "Fast (7)", "দ্রুত (৭)")}</option>
            </select>
          </label>
        </section>
        <section className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">{pick(lang, "Choose a topic", "একটি টপিক বেছে নাও")}</h2>
            <span className="rounded-full bg-marigold-soft px-3 py-1 text-[0.78rem] font-bold text-ink">{DIFF_LABEL(lang, adaptation?.difficulty ?? 2)} · {paceSetSize(learner.pace)} {pick(lang, "questions", "টি প্রশ্ন")}</span>
          </div>
          {adaptation?.reasons[0] ? <p className="mt-1 text-[0.85rem] text-ink-muted">{adaptation.reasons[0]}</p> : null}
          {summary.sessions > 0 ? (
            <p className="mt-1 text-[0.85rem] text-ink-muted">{pick(lang, `So far: ${summary.sessions} practice sessions, ${summary.correct}/${summary.questionsAnswered} correct (${summary.accuracy}%).`, `এখন পর্যন্ত: ${summary.sessions}টি অনুশীলন সেশন, ${summary.correct}/${summary.questionsAnswered} সঠিক (${summary.accuracy}%)।`)}</p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={startMixed} className="flex items-center gap-3 rounded-xl border-2 border-ink bg-lagoon-soft px-4 py-3 text-left transition-colors hover:bg-white">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-padma-ink"><Icon name="target" className="size-4.5" strokeWidth={1.9} /></span>
              <span>
                <span className="block font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Daily Mix", "আজকের মিক্স")}</span>
                <span className="block text-[0.8rem] text-ink-muted">{pick(lang, "A fresh question from five different topics.", "পাঁচটি ভিন্ন টপিক থেকে একটি করে নতুন প্রশ্ন।")}</span>
              </span>
            </button>
            {learner && buildReviewPracticeSet(learner, results) ? (
              <button type="button" onClick={startReview} className="flex items-center gap-3 rounded-xl border-2 border-ink bg-coral-soft px-4 py-3 text-left transition-colors hover:bg-white">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-shapla-ink"><Icon name="refresh" className="size-4.5" strokeWidth={1.9} /></span>
                <span>
                  <span className="block font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Mistake Review", "ভুলের রিভিশন")}</span>
                  <span className="block text-[0.8rem] text-ink-muted">{pick(lang, "Revisit the topics that tripped you up.", "যেসব টপিকে আটকেছিলে, সেগুলো আবার দেখো।")}</span>
                </span>
              </button>
            ) : null}
            {bookmarks.length > 0 ? (
              <button type="button" onClick={startBookmarks} className="flex items-center gap-3 rounded-xl border-2 border-ink bg-marigold-soft px-4 py-3 text-left transition-colors hover:bg-white">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-ember-ink"><Icon name="heart" className="size-4.5" strokeWidth={1.9} /></span>
                <span>
                  <span className="block font-display text-[0.95rem] font-bold text-ink">{pick(lang, "My Bookmarks", "আমার বুকমার্ক")}</span>
                  <span className="block text-[0.8rem] text-ink-muted">{pick(lang, `${bookmarks.length} saved question(s) to redo.`, `${bookmarks.length}টি সেভ করা প্রশ্ন আবার করার জন্য।`)}</span>
                </span>
              </button>
            ) : null}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topicOptions.map(({ subject, topic }) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => startSet(topic.id)}
                  className={`flex w-full flex-col gap-0.5 rounded-xl border-2 border-ink px-3.5 py-3 text-left transition-colors ${topicId === topic.id ? "bg-marigold-soft" : "bg-paper hover:bg-white"}`}
                >
                  <span className="text-[0.7rem] font-bold tracking-wide text-ink-muted uppercase">{t(lang, { en: subject.title, bn: subject.titleBn })}</span>
                  <span className="font-display text-[0.95rem] leading-snug font-bold text-ink">{t(lang, { en: topic.title, bn: topic.titleBn })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Practice", "অনুশীলন")} sub={pick(lang, "Hints first, answers later — try it yourself first.", "আগে হিন্ট, পরে উত্তর — আগে নিজে চেষ্টা করো।")} />
      <section className={`${CARD} mx-auto max-w-2xl p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.8rem] font-bold text-ink-muted">{pick(lang, `Question ${idx + 1} of ${set.questions.length}`, `প্রশ্ন ${idx + 1} / ${set.questions.length}`)} · {pick(lang, "Score", "স্কোর")}: {score}</p>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-[0.72rem] font-bold text-ink">{set.topicTitle} · {DIFF_LABEL(lang, set.difficulty)}</span>
            <button
              type="button"
              aria-pressed={bookmarks.some((b) => b.question.id === q.id)}
              aria-label={pick(lang, "Save this question", "এই প্রশ্নটি সেভ করো")}
              title={pick(lang, "Save this question", "এই প্রশ্নটি সেভ করো")}
              onClick={onToggleBookmark}
              className={`grid size-8 place-items-center rounded-full border-2 border-ink transition-colors ${bookmarks.some((b) => b.question.id === q.id) ? "bg-flame text-night" : "bg-white text-ink"}`}
            >
              <Icon name="heart" className="size-4" strokeWidth={2} />
            </button>
          </span>
        </div>
        <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full border border-ink/20 bg-paper">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${((idx + (picked !== null ? 1 : 0)) / set.questions.length) * 100}%` }} />
        </div>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">{q.question}</h2>
        {q.format === "numeric" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) choose(typed.trim()); }}
              disabled={picked !== null}
              inputMode="decimal"
              aria-label={pick(lang, "Type your answer", "তোমার উত্তর লেখো")}
              placeholder={pick(lang, "Type your answer…", "তোমার উত্তর লেখো…")}
              className="w-44 rounded-xl border-2 border-ink bg-white px-4 py-3 font-display text-lg font-bold text-ink placeholder:text-base placeholder:font-medium placeholder:text-ink-muted disabled:opacity-60"
            />
            <button type="button" disabled={picked !== null || !typed.trim()} onClick={() => choose(typed.trim())} className={`${BTN_SM} disabled:cursor-not-allowed disabled:opacity-50`}>
              <Icon name="check" className="size-4" strokeWidth={2.4} />{pick(lang, "Check answer", "উত্তর যাচাই করো")}
            </button>
          </div>
        ) : (
          <ul className={`mt-4 grid gap-2 ${q.options.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {q.options.map((op, i) => {
              const isRight = picked !== null && i === q.answerIndex;
              const isWrong = picked === i && i !== q.answerIndex;
              return (
                <li key={op}>
                  <button type="button" onClick={() => choose(i)} className={`w-full rounded-xl border-2 border-ink px-4 py-3 text-left font-semibold text-ink transition-colors ${isRight ? "bg-kolapata-soft" : isWrong ? "bg-coral-soft" : "bg-paper hover:bg-white"}`}>{op}</button>
                </li>
              );
            })}
          </ul>
        )}
        {q.workedExample ? (
          <div className="mt-3">
            <button type="button" aria-expanded={showExample} onClick={() => setShowExample((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
              <Icon name="book" className="size-4" strokeWidth={1.9} />{showExample ? pick(lang, "Hide the example", "উদাহরণ লুকাও") : pick(lang, "See a worked example first", "আগে একটি করে-দেখানো উদাহরণ দেখো")}
            </button>
            {showExample ? <p className="mt-2 rounded-lg bg-lagoon-soft px-3 py-2 text-sm text-ink-soft">{q.workedExample}</p> : null}
          </div>
        ) : null}
        {q.drawPrompt ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-marigold-soft px-3 py-2 text-sm font-semibold text-ink">
            <Icon name="pen" className="size-4 shrink-0" strokeWidth={1.9} />{pick(lang, "Draw it first: sketch the problem before you answer.", "আগে এঁকে নাও: উত্তর দেওয়ার আগে সমস্যাটির ছবি আঁকো।")}
          </p>
        ) : null}
        {picked === null ? (
          <div className="mt-4 flex flex-col items-start gap-2">
            <button type="button" aria-expanded={hintLevel > 0} onClick={() => setHintLevel((v) => (v > 0 ? 0 : 1))} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
              <Icon name="lightbulb" className="size-4" strokeWidth={1.9} />{hintLevel > 0 ? pick(lang, "Hide hint", "হিন্ট লুকাও") : pick(lang, "Show a hint", "হিন্ট দেখো")}
            </button>
            {hintLevel >= 1 ? <p className="rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">{q.hint}</p> : null}
            {hintLevel >= 1 && q.hint2 ? (
              hintLevel >= 2 ? (
                <p className="rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">{q.hint2}</p>
              ) : (
                <button type="button" onClick={() => setHintLevel(2)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
                  <Icon name="lightbulb" className="size-4" strokeWidth={1.9} />{pick(lang, "One more hint", "আরেকটি হিন্ট")}
                </button>
              )
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className={`text-sm font-bold ${isCorrectAnswer(q, picked) ? "text-kolapata" : "text-shapla-ink"}`}>
              {isCorrectAnswer(q, picked)
                ? pick(lang, "Correct — the light is on!", "সঠিক — আলো জ্বলে গেছে!")
                : q.format === "numeric"
                  ? pick(lang, `Not quite — the answer is ${q.answer}.`, `হয়নি — সঠিক উত্তর ${q.answer}।`)
                  : pick(lang, "Not quite — the right answer is highlighted.", "হয়নি — সঠিক উত্তরটা দেখিয়ে দেওয়া হয়েছে।")}
            </p>
            <p className="rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">{q.explanation}</p>
            <div>
              <button type="button" onClick={nextQ} className={BTN_SM}>{idx + 1 >= set.questions.length ? pick(lang, "See result", "ফলাফল দেখো") : pick(lang, "Next question", "পরের প্রশ্ন")}<Icon name="arrow" className="size-4" strokeWidth={2.2} /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function dueLabel(lang: Lang, a: HomeworkAssignment): string {
  const date = new Date(a.dueAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const today = new Date().toDateString() === new Date(a.dueAt).toDateString();
  return `${a.subjectTitle} · ${today ? pick(lang, "Due tonight", "আজ রাতে জমা") : `${pick(lang, "Due", "জমা")} ${date}`}`;
}

function HomeworkView() {
  const { lang } = useLang();
  const [list, setList] = useState<HomeworkAssignment[]>([]);
  const [classLevel, setClassLevel] = useState(6);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBucket, setNewBucket] = useState<DueBucket>("tomorrow");
  const [newRecurrence, setNewRecurrence] = useState<HomeworkAssignment["recurrence"]>("none");
  const [topicPick, setTopicPick] = useState("");
  const [topicBucket, setTopicBucket] = useState<DueBucket>("tonight");
  const [topicRecurrence, setTopicRecurrence] = useState<HomeworkAssignment["recurrence"]>("none");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const learner = loadLearner();
      setClassLevel(learner.classLevel);
      setMistakeCount(learner.mistakeTopics.length);
      setProfile(learner);
      setList(loadAssignments(learner.classLevel));
      setLoaded(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const now = new Date();
  const stats = completionStats(list);
  const visible = subjectFilter === "all" ? list : list.filter((a) => a.subjectId === subjectFilter);
  const subjects = [...new Map(list.map((a) => [a.subjectId, a.subjectTitle])).entries()];
  const pending = visible.filter((a) => a.status !== "done");
  const overdue = pending.filter(
    (a) => new Date(a.dueAt).getTime() < now.getTime(),
  );
  const upcoming = pending
    .filter((a) => new Date(a.dueAt).getTime() >= now.getTime())
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const completed = visible.filter((a) => a.status === "done");

  const topicOptions =
    getClass(classLevel)?.subjects.flatMap((s) =>
      s.chapters.flatMap((c) => c.topics.map((tp) => ({ subject: s, topic: tp }))),
    ) ?? [];

  /** Applies an update; completing a recurring assignment spawns its next occurrence. */
  function applyUpdate(a: HomeworkAssignment, updated: HomeworkAssignment) {
    setList((current) => {
      const next = current.map((x) => (x.id === a.id ? updated : x));
      const spawned =
        a.status !== "done" && updated.status === "done" ? nextOccurrence(updated) : null;
      const withNext = spawned ? [spawned, ...next] : next;
      saveAssignments(withNext);
      return withNext;
    });
  }

  function toggleDone(a: HomeworkAssignment) {
    applyUpdate(a, markDone(a, a.status !== "done"));
  }

  function toggleStep(a: HomeworkAssignment, stepIndex: number) {
    applyUpdate(a, toggleTask(a, stepIndex));
  }

  function addReviewFromMistakes() {
    const learner = loadLearner();
    const assignment = generateReviewHomework(
      learner.classLevel,
      learner.mistakeTopics,
      new Date(),
      personaFromLearner(learner),
    );
    if (!assignment) return;
    setList((current) => addAssignment(current, assignment));
  }

  function updatePersona(patch: Partial<LearnerProfile>) {
    if (!profile) return;
    const next = { ...profile, ...patch, updatedAt: new Date().toISOString() };
    saveLearner(next);
    setProfile(next);
  }

  function snooze(a: HomeworkAssignment) {
    setList((current) => {
      const next = current.map((x) => (x.id === a.id ? snoozeAssignment(x) : x));
      saveAssignments(next);
      return next;
    });
  }

  function printAssignment(a: HomeworkAssignment) {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tasks = a.tasks.length
      ? `<ol>${a.tasks.map((t) => `<li>☐ ${esc(lang === "bn" ? t.textBn : t.text)}</li>`).join("")}</ol>`
      : "";
    w.document.write(
      `<!doctype html><html><head><title>${esc(a.title)}</title><style>body{font-family:Georgia,serif;margin:40px;color:#222}h1{font-size:22px}ol li{margin:10px 0;line-height:1.5}.meta{color:#555}.lines{margin-top:28px}.lines div{border-bottom:1px solid #bbb;height:34px}</style></head><body>` +
        `<h1>${esc(lang === "bn" ? a.titleBn : a.title)}</h1>` +
        `<p class="meta">${esc(a.subjectTitle)} · ${esc(a.topicTitle)} · ${esc(new Date(a.dueAt).toLocaleDateString())} · ~${a.estMinutes} min</p>` +
        `<p>${esc(lang === "bn" ? a.instructionsBn : a.instructions)}</p>${tasks}` +
        `<div class="lines"><div></div><div></div><div></div><div></div><div></div><div></div></div>` +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function remove(a: HomeworkAssignment) {
    setList((current) => {
      const next = current.filter((x) => x.id !== a.id);
      saveAssignments(next);
      return next;
    });
  }

  function addCustom() {
    const title = newTitle.trim();
    if (!title) return;
    const assignment: HomeworkAssignment = {
      id: `hw-custom-${Date.now().toString(36)}`,
      title,
      titleBn: title,
      subjectId: "custom",
      subjectTitle: pick(lang, "My own work", "আমার নিজের কাজ"),
      topicId: "custom",
      topicTitle: title,
      instructions: title,
      instructionsBn: title,
      tasks: [],
      estMinutes: 10,
      recurrence: newRecurrence,
      source: "custom",
      dueBucket: newBucket,
      dueAt: dueAtForBucket(newBucket, new Date()).toISOString(),
      status: "assigned",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    setList((current) => addAssignment(current, assignment));
    setNewTitle("");
  }

  function addFromTopic() {
    if (!topicPick) return;
    const assignment = generateHomeworkFromTopic({
      classLevel,
      topicId: topicPick,
      dueBucket: topicBucket,
      source: "custom",
      now: new Date(),
      recurrence: topicRecurrence,
      persona: profile ? personaFromLearner(profile) : undefined,
    });
    setList((current) => addAssignment(current, assignment));
    setTopicPick("");
  }

  const renderCard = (a: HomeworkAssignment, late: boolean) => (
    <li key={a.id} className={`${CARD} flex flex-col gap-2 p-4 ${a.status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marigold-soft text-ember-ink"><Icon name="notes" className="size-4.5" strokeWidth={1.9} /></span>
        {late ? <span className="rounded-full bg-coral-soft px-2.5 py-0.5 text-[0.7rem] font-bold text-shapla-ink">{pick(lang, "Overdue", "দেরি হয়ে গেছে")}</span> : null}
      </div>
      <h3 className="font-display text-[1.02rem] leading-snug font-bold text-ink">{lang === "bn" ? a.titleBn : a.title}</h3>
      <p className="text-[0.85rem] leading-relaxed text-ink-soft">{lang === "bn" ? a.instructionsBn : a.instructions}</p>
      {a.tasks.length > 0 ? (
        <fieldset className="mt-1">
          <legend className="text-[0.78rem] font-bold text-ink-muted">
            {pick(lang, `Steps · ${taskProgress(a).done}/${taskProgress(a).total} done`, `ধাপ · ${taskProgress(a).done}/${taskProgress(a).total} শেষ`)}
          </legend>
          <ul className="mt-1.5 flex flex-col gap-1">
            {a.tasks.map((step, si) => (
              <li key={`${a.id}-step-${si}`}>
                <button
                  type="button"
                  aria-pressed={step.done}
                  onClick={() => toggleStep(a, si)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[0.85rem] font-medium transition-colors ${step.done ? "text-ink-muted line-through" : "text-ink hover:bg-paper"}`}
                >
                  <span aria-hidden="true" className={`mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border-2 border-ink ${step.done ? "bg-kolapata text-white" : "bg-white"}`}>
                    {step.done ? <Icon name="check" className="size-3" strokeWidth={3} /> : null}
                  </span>
                  {lang === "bn" ? step.textBn : step.text}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-2 text-[0.8rem] font-semibold text-ink-muted">
        <span>{dueLabel(lang, a)}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1"><Icon name="clock" className="size-3.5" strokeWidth={2} />{pick(lang, `~${a.estMinutes} min`, `~${a.estMinutes} মিনিট`)}</span>
        {a.recurrence !== "none" ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1"><Icon name="refresh" className="size-3.5" strokeWidth={2} />{a.recurrence === "daily" ? pick(lang, "Repeats daily", "প্রতিদিন আবার") : pick(lang, "Repeats weekly", "প্রতি সপ্তাহে আবার")}</span>
          </>
        ) : null}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button type="button" aria-pressed={a.status === "done"} onClick={() => toggleDone(a)} className={BTN_SM}>
          <Icon name="check" className="size-4" strokeWidth={2.4} />{a.status === "done" ? pick(lang, "Done", "শেষ হয়েছে") : pick(lang, "Mark done", "শেষ হয়েছে বলো")}
        </button>
        {a.status !== "done" ? (
          <button type="button" onClick={() => snooze(a)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
            <Icon name="clock" className="size-4" strokeWidth={2} />{pick(lang, "Tomorrow instead", "কাল করব")}
          </button>
        ) : null}
        <button type="button" onClick={() => printAssignment(a)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
          <Icon name="print" className="size-4" strokeWidth={2} />{pick(lang, "Print", "প্রিন্ট")}
        </button>
        <button type="button" onClick={() => remove(a)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold text-ink">
          {pick(lang, "Remove", "বাদ দাও")}
        </button>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-[84rem]">
      <PageHead title={pick(lang, "Homework", "হোমওয়ার্ক")} sub={pick(lang, "Tonight's work — tick each one off as you finish. Stuck? Ask your AI teacher.", "আজকের কাজ — শেষ হলেই টিক দাও। আটকে গেলে AI শিক্ষককে জিজ্ঞেস করো।")} />
      {loaded && profile ? (
        <section aria-label={pick(lang, "Your learning style", "তোমার শেখার ধরন")} className={`${CARD} mb-4 flex flex-wrap items-end gap-3 p-4`}>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[1.02rem] font-bold text-ink">{pick(lang, "Homework made for you", "তোমার জন্য তৈরি হোমওয়ার্ক")}</h2>
            <p className="text-[0.85rem] text-ink-muted">{pick(lang, "New tasks are shaped by how you like to learn. Change anytime.", "নতুন কাজগুলো তোমার পছন্দমতো সাজানো হয়। যেকোনো সময় বদলাও।")}</p>
          </div>
          <label className="flex flex-col gap-1 text-[0.78rem] font-bold text-ink-muted">
            {pick(lang, "I learn best…", "আমি সবচেয়ে ভালো শিখি…")}
            <select
              value={profile.preferredStyle}
              onChange={(e) => updatePersona({ preferredStyle: e.target.value as LearnerProfile["preferredStyle"] })}
              className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              <option value="step-by-step">{pick(lang, "Step by step", "ধাপে ধাপে")}</option>
              <option value="examples-first">{pick(lang, "Examples first", "আগে উদাহরণ")}</option>
              <option value="visual">{pick(lang, "With pictures", "ছবি দিয়ে")}</option>
              <option value="challenge">{pick(lang, "Challenge me", "চ্যালেঞ্জ দাও")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.78rem] font-bold text-ink-muted">
            {pick(lang, "My pace…", "আমার গতি…")}
            <select
              value={profile.pace}
              onChange={(e) => updatePersona({ pace: e.target.value as LearnerProfile["pace"] })}
              className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              <option value="slow">{pick(lang, "Slow & steady", "ধীরে ধীরে")}</option>
              <option value="steady">{pick(lang, "Steady", "নিয়মিত")}</option>
              <option value="fast">{pick(lang, "Fast", "দ্রুত")}</option>
            </select>
          </label>
        </section>
      ) : null}
      {loaded && subjects.length > 1 ? (
        <div role="group" aria-label={pick(lang, "Filter by subject", "বিষয় অনুযায়ী দেখো")} className="mb-4 flex flex-wrap gap-2">
          {["all", ...subjects.map(([id]) => id)].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={subjectFilter === id}
              onClick={() => setSubjectFilter(id)}
              className={`rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-bold transition-colors ${subjectFilter === id ? "bg-ink text-paper" : "bg-white text-ink hover:bg-paper"}`}
            >
              {id === "all" ? pick(lang, "All subjects", "সব বিষয়") : subjects.find(([s]) => s === id)?.[1]}
            </button>
          ))}
        </div>
      ) : null}
      {loaded && stats.total > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-soft">
            {pick(lang, `${stats.done} of ${stats.total} done (${stats.rate}%).`, `${stats.total}টির মধ্যে ${stats.done}টি শেষ (${stats.rate}%)।`)}
            {" · "}
            {pick(lang, `${totalPoints(list)} points in total.`, `মোট ${totalPoints(list)} পয়েন্ট।`)}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[0.8rem] font-bold text-ink-muted">{pick(lang, "This week's goal", "এই সপ্তাহের লক্ষ্য")}</span>
            <div aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-full border border-ink/20 bg-paper">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (pointsThisWeek(list, new Date()) / WEEKLY_GOAL_POINTS) * 100)}%` }} />
            </div>
            <span className="text-[0.8rem] font-bold text-ink">{pointsThisWeek(list, new Date())}/{WEEKLY_GOAL_POINTS} {pick(lang, "pts", "পয়েন্ট")}</span>
          </div>
          {overdueCount(list, new Date()) > 0 ? (
            <p role="status" className="rounded-xl border border-coral/40 bg-coral-soft px-3 py-2 text-sm font-semibold text-shapla-ink">
              {pick(lang, `Reminder: ${overdueCount(list, new Date())} assignment(s) are overdue — finish those first.`, `মনে করিয়ে দিই: ${overdueCount(list, new Date())}টি হোমওয়ার্ক দেরি হয়ে গেছে — সেগুলো আগে শেষ করো।`)}
            </p>
          ) : null}
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <section aria-label={pick(lang, "Overdue homework", "দেরি হয়ে যাওয়া হোমওয়ার্ক")} className="mb-4">
          <h2 className="mb-2 font-display text-lg font-bold text-shapla-ink">{pick(lang, "Overdue — finish these first", "দেরি হয়ে গেছে — এগুলো আগে শেষ করো")}</h2>
          <ul className="grid gap-3 lg:grid-cols-3">{overdue.map((a) => renderCard(a, true))}</ul>
        </section>
      ) : null}

      <section aria-label={pick(lang, "Homework to do", "বাকি হোমওয়ার্ক")}>
        <h2 className="mb-2 font-display text-lg font-bold text-ink">{pick(lang, "To do", "যা যা বাকি")}</h2>
        {upcoming.length === 0 && overdue.length === 0 ? (
          <p className={`${CARD} p-4 text-sm text-ink-soft`}>{pick(lang, "Nothing due — nice work! Add a task below or pick a topic from your book.", "কিছু বাকি নেই — দারুণ! নিচে নতুন কাজ যোগ করো অথবা বই থেকে টপিক বেছে নাও।")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-3">{upcoming.map((a) => renderCard(a, false))}</ul>
        )}
      </section>

      {loaded && mistakeCount > 0 ? (
        <section className={`${CARD} mb-4 flex flex-wrap items-center gap-3 p-4`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-coral-soft text-shapla-ink"><Icon name="refresh" className="size-4.5" strokeWidth={1.9} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[1.02rem] font-bold text-ink">{pick(lang, "Tricky topics to revisit", "আটকে যাওয়া টপিকগুলো আবার দেখো")}</h2>
            <p className="text-[0.85rem] text-ink-muted">{pick(lang, `${mistakeCount} topic(s) tripped you up recently. Turn one into short review homework.`, `সম্প্রতি ${mistakeCount}টি টপিকে আটকেছিলে। একটি থেকে ছোট রিভিশন হোমওয়ার্ক বানাও।`)}</p>
          </div>
          <button type="button" onClick={addReviewFromMistakes} className={BTN_SM}>
            <Icon name="notes" className="size-4" strokeWidth={2} />{pick(lang, "Add review homework", "রিভিশন হোমওয়ার্ক যোগ করো")}
          </button>
        </section>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className={`${CARD} p-4`}>
          <h2 className="font-display text-[1.02rem] font-bold text-ink">{pick(lang, "From your book", "তোমার বই থেকে")}</h2>
          <p className="mt-0.5 text-[0.85rem] text-ink-muted">{pick(lang, "Pick a topic — we will write tonight's task from it.", "একটি টপিক বেছে নাও — সেটি দিয়েই আজকের কাজ বানিয়ে দিচ্ছি।")}</p>
          <div className="mt-3 flex flex-col gap-2">
            <select aria-label={pick(lang, "Topic", "টপিক")} value={topicPick} onChange={(e) => setTopicPick(e.target.value)} className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold text-ink">
              <option value="">{pick(lang, "Choose a topic…", "টপিক বেছে নাও…")}</option>
              {topicOptions.map(({ subject, topic }) => (
                <option key={topic.id} value={topic.id}>{t(lang, { en: subject.title, bn: subject.titleBn })} — {t(lang, { en: topic.title, bn: topic.titleBn })}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <select aria-label={pick(lang, "Due", "জমার সময়")} value={topicBucket} onChange={(e) => setTopicBucket(e.target.value as DueBucket)} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
                <option value="tonight">{pick(lang, "Tonight", "আজ রাতে")}</option>
                <option value="tomorrow">{pick(lang, "Tomorrow", "আগামীকাল")}</option>
                <option value="friday">{pick(lang, "Friday", "শুক্রবার")}</option>
                <option value="weekend">{pick(lang, "Weekend", "সাপ্তাহিক ছুটি")}</option>
              </select>
              <select aria-label={pick(lang, "Repeat", "আবার হবে")} value={topicRecurrence} onChange={(e) => setTopicRecurrence(e.target.value as HomeworkAssignment["recurrence"])} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
                <option value="none">{pick(lang, "Once", "একবার")}</option>
                <option value="daily">{pick(lang, "Daily", "প্রতিদিন")}</option>
                <option value="weekly">{pick(lang, "Weekly", "প্রতি সপ্তাহে")}</option>
              </select>
              <button type="button" disabled={!topicPick} onClick={addFromTopic} className={`${BTN_SM} disabled:cursor-not-allowed disabled:opacity-50`}>
                <Icon name="notes" className="size-4" strokeWidth={2} />{pick(lang, "Add homework", "হোমওয়ার্ক যোগ করো")}
              </button>
            </div>
          </div>
        </section>

        <section className={`${CARD} p-4`}>
          <h2 className="font-display text-[1.02rem] font-bold text-ink">{pick(lang, "Add your own", "নিজে যোগ করো")}</h2>
          <p className="mt-0.5 text-[0.85rem] text-ink-muted">{pick(lang, "Teacher gave extra work? Note it here so it is not forgotten.", "শিক্ষক বাড়তি কাজ দিয়েছেন? এখানে লিখে রাখো, ভুলবে না।")}</p>
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
              placeholder={pick(lang, "e.g. Read pages 40–42 and note 5 words", "যেমন: ৪০–৪২ পৃষ্ঠা পড়ো, ৫টি শব্দ লেখো")}
              className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-medium text-ink placeholder:text-ink-muted"
            />
            <div className="flex flex-wrap gap-2">
              <select aria-label={pick(lang, "Due", "জমার সময়")} value={newBucket} onChange={(e) => setNewBucket(e.target.value as DueBucket)} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
                <option value="tonight">{pick(lang, "Tonight", "আজ রাতে")}</option>
                <option value="tomorrow">{pick(lang, "Tomorrow", "আগামীকাল")}</option>
                <option value="friday">{pick(lang, "Friday", "শুক্রবার")}</option>
                <option value="weekend">{pick(lang, "Weekend", "সাপ্তাহিক ছুটি")}</option>
              </select>
              <select aria-label={pick(lang, "Repeat", "আবার হবে")} value={newRecurrence} onChange={(e) => setNewRecurrence(e.target.value as HomeworkAssignment["recurrence"])} className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-semibold text-ink">
                <option value="none">{pick(lang, "Once", "একবার")}</option>
                <option value="daily">{pick(lang, "Daily", "প্রতিদিন")}</option>
                <option value="weekly">{pick(lang, "Weekly", "প্রতি সপ্তাহে")}</option>
              </select>
              <button type="button" disabled={!newTitle.trim()} onClick={addCustom} className={`${BTN_SM} disabled:cursor-not-allowed disabled:opacity-50`}>
                <Icon name="check" className="size-4" strokeWidth={2.2} />{pick(lang, "Add", "যোগ করো")}
              </button>
            </div>
          </div>
        </section>
      </div>

      {completed.length > 0 ? (
        <section aria-label={pick(lang, "Completed homework", "সম্পন্ন হোমওয়ার্ক")} className="mt-4">
          <h2 className="mb-2 font-display text-lg font-bold text-ink">{pick(lang, "Completed", "সম্পন্ন")}</h2>
          <ul className="grid gap-3 lg:grid-cols-3">{completed.map((a) => renderCard(a, false))}</ul>
        </section>
      ) : null}
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
      {section === "progress" ? <ProgressStats lang={lang} /> : null}
      {!["subjects", "profile", "progress"].includes(section) ? (
        <section className={`${CARD} max-w-xl p-5`}>
          <p className="text-sm leading-relaxed text-ink-soft">{pick(lang, "This part of your dashboard is ready for your content. Use the sidebar — Lesson, Revision, Practice, Homework and Games are fully working.", "ড্যাশবোর্ডের এই অংশ তোমার কনটেন্টের জন্য তৈরি। সাইডবারের লেসন, রিভিশন, অনুশীলন, হোমওয়ার্ক ও গেমস পুরোপুরি কাজ করছে।")}</p>
        </section>
      ) : null}
    </div>
  );
}

function ProgressStats({ lang }: { lang: Lang }) {
  const [stats, setStats] = useState<{
    quizAccuracy: number | null;
    practice: ReturnType<typeof summarizePractice> | null;
    homework: ReturnType<typeof completionStats> | null;
  }>({ quizAccuracy: null, practice: null, homework: null });
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const learner = loadLearner();
      setStats({
        quizAccuracy:
          learner.quizAttempted > 0 ? Math.round((learner.quizCorrect / learner.quizAttempted) * 100) : null,
        practice: summarizePractice(loadPracticeResults()),
        homework: completionStats(loadAssignments(learner.classLevel)),
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const row = (label: string, value: string) => (
    <li className="flex justify-between rounded-lg bg-paper px-3 py-2"><span>{label}</span><strong className="text-ink">{value}</strong></li>
  );
  return (
    <section className={`${CARD} max-w-xl p-5`}>
      <h2 className="font-display text-lg font-bold text-ink">{pick(lang, "Your learning so far", "এ পর্যন্ত তোমার শেখা")}</h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
        {row(pick(lang, "Class & practice accuracy", "ক্লাস ও অনুশীলনের নির্ভুলতা"), stats.quizAccuracy === null ? "—" : `${stats.quizAccuracy}%`)}
        {row(pick(lang, "Practice sessions", "অনুশীলন সেশন"), stats.practice && stats.practice.sessions > 0 ? `${stats.practice.sessions} · ${stats.practice.accuracy}%` : "—")}
        {row(pick(lang, "Homework done", "হোমওয়ার্ক শেষ"), stats.homework && stats.homework.total > 0 ? `${stats.homework.done}/${stats.homework.total}` : "—")}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/dashboard/practice" className={BTN_SM}><Icon name="play" className="size-4" />{pick(lang, "Practice now", "এখন অনুশীলন করো")}</Link>
        <Link href="/dashboard/homework" className={BTN_SM}><Icon name="notes" className="size-4" />{pick(lang, "Open homework", "হোমওয়ার্ক খোলো")}</Link>
      </div>
    </section>
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
