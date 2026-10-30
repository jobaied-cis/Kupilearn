"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { pick, useLang } from "../../lib/i18n";
import { revisionFetch } from "../../lib/revision/client";
import { REVISION_CONFIG } from "../../lib/revision/config";
import {
  clearActiveSessionId,
  remainingConcepts,
  revisionQuestionId,
  saveActiveSessionId,
  selectSessionConcepts,
} from "../../lib/revision/session-runner";
import type { EnrichedPlannedItem } from "../../lib/revision/service";
import type { RevisionSession } from "../../lib/revision/types";
import type { LessonQuestion } from "../../lib/lesson/engine";

const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:opacity-60";

interface QueueItem {
  conceptId: string;
  name: string;
  nameBn: string;
  questionIndex: number;
  question: LessonQuestion;
}

interface Props {
  items: EnrichedPlannedItem[];
  resumeSessionId?: string | null;
  reviewedConceptIds?: string[];
  onDone: () => void;
}

export function RevisionSessionRunner({ items, resumeSessionId = null, reviewedConceptIds = [], onDone }: Props) {
  const { lang } = useLang();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<RevisionSession | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(resumeSessionId);
  const submittedRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      void (async () => {
        try {
          if (!sessionIdRef.current) {
            const created = await revisionFetch<{ session: RevisionSession }>("/api/revision/sessions", {
              method: "POST",
              body: JSON.stringify({ sessionType: "daily" }),
            });
            sessionIdRef.current = created.session.sessionId;
            saveActiveSessionId(created.session.sessionId);
          }
          const planned = selectSessionConcepts(
            items
              .filter((i) => i.concept)
              .map((i) => ({ conceptId: i.conceptId, topicId: i.concept?.topicId ?? i.conceptId, classLevel: i.concept?.classLevel ?? 8 })),
          );
          const concepts = resumeSessionId ? remainingConcepts(planned, reviewedConceptIds) : planned;
          const built: QueueItem[] = [];
          const skippedNames: string[] = [];
          for (const concept of concepts) {
            if (built.length >= REVISION_CONFIG.session.maxQuestionsPerSession) break;
            const item = items.find((i) => i.conceptId === concept.conceptId);
            const name = item?.concept?.name ?? concept.conceptId;
            const nameBn = item?.concept?.nameBn ?? name;
            try {
              const res = await fetch("/api/lessons", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ topicId: concept.topicId, classLevel: concept.classLevel }),
              });
              const data = (await res.json()) as { lesson?: { questions?: LessonQuestion[] } };
              const questions = (data.lesson?.questions ?? []).slice(0, REVISION_CONFIG.session.questionsPerConcept);
              if (questions.length === 0) {
                skippedNames.push(name);
                continue;
              }
              questions.forEach((question, questionIndex) => {
                if (built.length < REVISION_CONFIG.session.maxQuestionsPerSession) {
                  built.push({ conceptId: concept.conceptId, name, nameBn, questionIndex, question });
                }
              });
            } catch {
              skippedNames.push(name);
            }
          }
          if (cancelled) return;
          setSkipped(skippedNames);
          setQueue(built);
        } catch {
          if (!cancelled) setFatal("SESSION_FAILED");
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // Queue is built once on mount from the plan snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = queue?.[idx] ?? null;
  const total = queue?.length ?? 0;

  async function answer(option: string) {
    if (!current || picked !== null || !sessionIdRef.current) return;
    const questionId = revisionQuestionId(current.conceptId, current.questionIndex);
    if (submittedRef.current.has(questionId)) return;
    submittedRef.current.add(questionId);
    const isCorrect = option === current.question.answer;
    setPicked(option);
    try {
      await revisionFetch("/api/revision/attempts", {
        method: "POST",
        body: JSON.stringify({
          conceptId: current.conceptId,
          questionId,
          studentAnswer: option,
          isCorrect,
          sessionId: sessionIdRef.current,
          source: "revision",
        }),
      });
      setRecorded(true);
      if (isCorrect) setCorrectCount((c) => c + 1);
    } catch {
      // Not recorded: allow a retry of the same question, never fake it.
      submittedRef.current.delete(questionId);
      setRecorded(false);
    }
  }

  async function finish() {
    if (!sessionIdRef.current) return;
    try {
      const done = await revisionFetch<{ session: RevisionSession }>("/api/revision/sessions", {
        method: "POST",
        body: JSON.stringify({ action: "complete", sessionId: sessionIdRef.current }),
      });
      clearActiveSessionId();
      setSummary(done.session);
    } catch {
      setFatal("SESSION_FAILED");
    }
  }

  function next() {
    setPicked(null);
    setRecorded(null);
    if (idx + 1 >= total) void finish();
    else setIdx(idx + 1);
  }

  if (fatal) {
    return (
      <div className={`${CARD} p-6 text-center`} role="alert">
        <h2 className="text-lg text-ink">{pick(lang, "The session could not be loaded", "সেশন লোড করা যায়নি")}</h2>
        <button type="button" className={`${BTN} mt-4`} onClick={onDone}>{pick(lang, "Back to revision", "রিভিশনে ফিরে যাও")}</button>
      </div>
    );
  }

  if (summary) {
    const accuracy = summary.totalQuestions > 0 ? Math.round((summary.correctAnswers / summary.totalQuestions) * 100) : 0;
    return (
      <div className={`${CARD} p-5`} role="status">
        <h2 className="text-xl text-ink">{pick(lang, "Session complete", "সেশন শেষ")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [pick(lang, "Concepts revised", "রিভিশন করা টপিক"), String(summary.conceptsReviewed.length)],
            [pick(lang, "Questions", "প্রশ্ন"), String(summary.totalQuestions)],
            [pick(lang, "Correct", "সঠিক"), String(summary.correctAnswers)],
            [pick(lang, "Accuracy", "সঠিকের হার"), `${accuracy}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-paper px-3 py-2">
              <dt className="text-[0.75rem] font-semibold text-ink-muted">{label}</dt>
              <dd className="font-display text-xl font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {skipped.length > 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{pick(lang, `Skipped (no questions available): ${skipped.join(", ")}`, `বাদ গেছে (প্রশ্ন পাওয়া যায়নি): ${skipped.join(", ")}`)}</p>
        ) : null}
        <button type="button" className={`${BTN} mt-4`} onClick={onDone}>{pick(lang, "Done", "হয়ে গেছে")}</button>
      </div>
    );
  }

  if (!queue) {
    return <div className={`${CARD} h-40 animate-pulse p-5`} role="status" aria-label={pick(lang, "Preparing your session", "তোমার সেশন তৈরি হচ্ছে")} />;
  }

  if (!current) {
    return (
      <div className={`${CARD} p-6 text-center`}>
        <h2 className="text-lg text-ink">{pick(lang, "No revision questions are available right now", "এখন কোনো রিভিশন প্রশ্ন পাওয়া যাচ্ছে না")}</h2>
        {skipped.length > 0 ? <p className="mt-1 text-sm text-ink-soft">{skipped.join(", ")}</p> : null}
        <button type="button" className={`${BTN} mt-4`} onClick={() => void finish()}>{pick(lang, "Close session", "সেশন বন্ধ করো")}</button>
      </div>
    );
  }

  const answered = picked !== null;
  const isCorrect = answered && picked === current.question.answer;
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg text-ink">{lang === "bn" ? current.nameBn : current.name}</h2>
        <span className="text-xs font-bold text-ink-muted">
          {idx + 1} / {total} · {correctCount} {pick(lang, "correct", "সঠিক")}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-edge" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={total}>
        <div className="h-full bg-flame transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <p className="mt-4 text-[1.05rem] font-semibold text-ink">{current.question.question}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {current.question.options.map((option) => {
          const isPicked = picked === option;
          const showCorrect = answered && option === current.question.answer;
          return (
            <button
              key={option}
              type="button"
              disabled={answered && recorded !== false}
              onClick={() => void answer(option)}
              className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${showCorrect ? "border-kolapata bg-jolpai-soft text-ink" : isPicked && recorded !== false ? "border-shapla bg-coral-soft text-ink" : "border-paper-edge bg-paper text-ink hover:border-ink/40"}`}
            >
              {option}
              {showCorrect ? <Icon name="check" className="ml-2 inline size-4" strokeWidth={2.4} /> : null}
            </button>
          );
        })}
      </div>
      {answered && recorded === false ? (
        <p className="mt-3 text-sm font-semibold text-shapla-ink" role="alert">
          {pick(lang, "That answer could not be recorded. Tap your answer again.", "উত্তরটি রাখা যায়নি। আবার তোমার উত্তরটি চাপ দাও।")}
          <button type="button" className="ml-2 underline" onClick={() => { setPicked(null); setRecorded(null); }}>{pick(lang, "Retry", "আবার চেষ্টা")}</button>
        </p>
      ) : answered ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-bold ${isCorrect ? "text-kolapata" : "text-shapla-ink"}`}>
            {isCorrect ? pick(lang, "Correct. The light stays on.", "সঠিক। আলোটা জ্বলতে থাকুক।") : `${pick(lang, "Not quite. Correct answer:", "পুরোপুরি হয়নি। সঠিক উত্তর:")} ${current.question.answer}`}
          </p>
          <button type="button" className={BTN} onClick={next}>
            {idx + 1 >= total ? pick(lang, "Finish", "শেষ করো") : pick(lang, "Next", "পরেরটা")}
          </button>
        </div>
      ) : (
        <div className="mt-3 text-right">
          <button type="button" className="text-sm font-bold text-ink-muted underline" onClick={() => void finish()}>
            {pick(lang, "End session early", "সেশন আগেই শেষ করো")}
          </button>
        </div>
      )}
    </div>
  );
}
