"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Whiteboard } from "./Whiteboard";
import { pick, useLang } from "../../lib/i18n";
import { mathBookForClass, type MathChapter } from "../../lib/nctb/math-book";
import { MATH_CLASSMATES, MATH_TEACHERS, buildRegistry } from "../../lib/classroom/catalog";
import type { StructuredLesson, VizInstruction } from "../../lib/lesson/engine";
import type { RetrievedPassage } from "../../lib/rag/retrieve";
import { adaptLearner, recordAnswer } from "../../lib/learner/adapt";
import { loadLearner, saveLearner } from "../../lib/learner/store";
import type { ClassroomTurnResponse } from "../../lib/classroom/types";

type Msg = { who: string; role: string; text: string; color: string };
const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:opacity-50";

function speak(text: string, bn: boolean, rate = 0.95) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 240));
    u.lang = bn ? "bn-BD" : "en-US";
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch { /* speech is optional */ }
}

export function ClassroomLive() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [classLevel, setClassLevel] = useState(6);
  const [chapterId, setChapterId] = useState("c6m-ch1");
  const [concept, setConcept] = useState<string>("whole");
  const [teacherId, setTeacherId] = useState(MATH_TEACHERS[0]!.id);
  const [mates, setMates] = useState<string[]>(MATH_CLASSMATES.map((c) => c.id));
  const [lesson, setLesson] = useState<StructuredLesson | null>(null);
  const [sources, setSources] = useState<RetrievedPassage[]>([]);
  const [missingSource, setMissingSource] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [answerState, setAnswerState] = useState<Record<number, boolean>>({});
  const turnState = useRef<unknown>(null);
  const registryRef = useRef<unknown>(null);

  const book = mathBookForClass(classLevel);
  const chapter: MathChapter | null = book.available ? (book.chapters.find((c) => c.id === chapterId) ?? book.chapters[0] ?? null) : null;
  const conceptTitle = chapter ? (concept === "whole" ? chapter.title : (chapter.subtopics.find((s) => s.id === concept)?.title ?? chapter.title)) : "";

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = loadLearner();
      if (p.classLevel >= 6 && p.classLevel <= 10) setClassLevel(p.classLevel);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const boardSteps: VizInstruction[] = lesson
    ? lesson.explanations.slice(0, stepIdx + 1).flatMap((e) => e.board)
    : chapter ? [{ kind: "write", content: pick(lang, chapter.title, chapter.titleBn) }, { kind: "highlight", content: chapter.objectives[0] ?? "" }] : [];

  async function startClass() {
    if (!chapter) return;
    setBusy(true);
    try {
      const learner = loadLearner();
      const adaptation = adaptLearner(learner);
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classLevel, chapterId: chapter.id, query: conceptTitle, language: lang, difficulty: adaptation.difficulty }),
      });
      const data = (await res.json()) as { lesson: StructuredLesson; degraded: boolean; sources: RetrievedPassage[]; missingSource: boolean };
      setLesson(data.lesson);
      setDegraded(!!data.degraded);
      setSources(data.sources ?? []);
      setMissingSource(!!data.missingSource);
      setStepIdx(0);
      setAnswerState({});
      registryRef.current = buildRegistry({ teacherId, classmateIds: mates, classLevel, subject: "Mathematics", topicTitle: conceptTitle });
      turnState.current = null;
      const teacher = MATH_TEACHERS.find((t) => t.id === teacherId);
      const intro = data.lesson.introduction;
      setMsgs([{ who: teacher?.name ?? "Teacher", role: "teacher", text: intro, color: "bg-flame text-night" }]);
      if (voiceOn) speak(intro, bn, teacherId === "rakib" ? 1.05 : 0.9);
      await nextTurn();
    } finally {
      setBusy(false);
    }
  }

  async function nextTurn(studentInput?: string, correct?: boolean | null) {
    if (!registryRef.current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/turns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registry: registryRef.current, state: turnState.current ?? undefined, student_input: studentInput, student_answer_correct: correct ?? null }),
      });
      const data = (await res.json()) as ClassroomTurnResponse;
      turnState.current = data.state;
      registryRef.current = data.registry;
      if (data.turn) {
        const turn = data.turn;
        const card = MATH_CLASSMATES.find((c) => turn.speaker.display_name === c.name);
        const tcard = MATH_TEACHERS.find((t) => t.name === turn.speaker.display_name);
        setMsgs((m) => [...m.slice(-29), { who: turn.speaker.display_name, role: turn.speaker.role, text: turn.content.text, color: card?.color ?? tcard?.color ?? "bg-brand-50 text-brand-700" }]);
        if (voiceOn) speak(turn.content.text, bn);
      }
    } catch {
      setMsgs((m) => [...m, { who: "Kupi", role: "teacher", text: pick(lang, "The class connection paused. Your lesson is saved here — try Continue Class.", "ক্লাসের সংযোগ থেমেছে। লেসন এখানেই আছে — Continue Class চাপো।"), color: "bg-flame text-night" }]);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { who: pick(lang, "You", "তুমি"), role: "student", text, color: "bg-night text-paper" }]);
    const p = loadLearner();
    saveLearner({ ...p, classLevel, interactions: p.interactions + 1 });
    void nextTurn(text);
  }

  function answer(qIdx: number, correct: boolean) {
    setAnswerState((s) => ({ ...s, [qIdx]: correct }));
    saveLearner(recordAnswer(loadLearner(), correct, chapter?.id));
  }

  function listen() {
    const w = window as unknown as { SpeechRecognition?: new () => { lang: string; start(): void; onresult: (e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void }; webkitSpeechRecognition?: new () => { lang: string; start(): void; onresult: (e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void } };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = bn ? "bn-BD" : "en-US";
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.start();
  }

  const sel = "h-11 w-full rounded-xl border-2 border-ink bg-paper px-3 text-sm font-semibold text-ink outline-none";

  return (
    <div className="mx-auto flex max-w-[84rem] flex-col gap-4">
      <div>
        <h1 className="text-[clamp(1.35rem,3vw,1.8rem)] leading-tight text-ink">{pick(lang, "Mathematics Classroom", "গণিত ক্লাসরুম")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, "NCTB Mathematics, taught like a real class — your teacher on the board, three classmates beside you.", "NCTB গণিত, আসল ক্লাসের মতো — বোর্ডে তোমার শিক্ষক, পাশে তিন সহপাঠী।")}</p>
      </div>

      {degraded ? (
        <p role="status" className="rounded-xl border border-marigold/60 bg-marigold-soft px-3 py-2 text-sm font-medium text-ember-ink">
          {pick(lang, "Offline lesson mode: Meta is not configured on the server yet, so lessons are built from your uploaded NCTB textbook chapters. Add META_API_KEY in .env.local to go live.", "অফলাইন লেসন মোড: সার্ভারে Meta এখনো কনফিগার হয়নি, তাই লেসন তৈরি হচ্ছে তোমার আপলোড করা NCTB বইয়ের অধ্যায় থেকে। লাইভ করতে .env.local-এ META_API_KEY বসাও।")}
        </p>
      ) : null}

      {/* Class + chapter selection (same as the book) */}
      <section className={`${CARD} p-4`} aria-label={pick(lang, "Chapter selection", "অধ্যায় বাছাই")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[0.8rem] font-bold text-ink">{pick(lang, "Class", "শ্রেণি")}
            <select className={sel} value={classLevel} onChange={(e) => { setClassLevel(Number(e.target.value)); setChapterId("c6m-ch1"); setConcept("whole"); setLesson(null); }}>
              {[6, 7, 8, 9, 10].map((c) => <option key={c} value={c}>{pick(lang, `Class ${c} · Mathematics`, `শ্রেণি ${c} · গণিত`)}</option>)}
            </select>
          </label>
          <p className="flex items-end pb-2 text-[0.82rem] text-ink-muted">
            {book.available ? book.edition : pick(lang, "No textbook uploaded for this class yet.", "এই শ্রেণির বই এখনো আপলোড হয়নি।")}
          </p>
        </div>

        {!book.available ? (
          <p role="alert" className="mt-3 rounded-xl border border-coral/40 bg-coral-soft px-3 py-2.5 text-sm font-medium text-shapla-ink">
            {pick(lang, `Source missing: ${book.reason} Chapters are not invented.`, `উৎস নেই: এই শ্রেণির NCTB গণিত বই আপলোড হয়নি, তাই অধ্যায় দেখানো হচ্ছে না। Book ফোল্ডারে অফিসিয়াল PDF দিয়ে RAG ingestion চালাও।`)}
          </p>
        ) : (
          <>
            <h2 className="mt-4 font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Choose a chapter from your book", "বই থেকে অধ্যায় বেছে নাও")}</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {book.chapters.map((ch) => (
                <li key={ch.id}>
                  <button type="button" aria-pressed={chapter?.id === ch.id} onClick={() => { setChapterId(ch.id); setConcept("whole"); }}
                    className={`h-full w-full rounded-2xl border-2 border-ink p-3 text-left ${chapter?.id === ch.id ? "bg-marigold-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="grid size-9 place-items-center rounded-full border-2 border-ink bg-flame font-display text-sm font-bold text-night">{ch.number}</span>
                      <span className="text-[0.7rem] font-bold text-ink-muted">{pick(lang, `Book p. ${ch.bookPage}`, `বই পৃ. ${ch.bookPage}`)}</span>
                    </span>
                    <span className="mt-2 block font-display text-[0.95rem] leading-snug font-bold text-ink">{pick(lang, ch.title, ch.titleBn)}</span>
                    <span className="mt-0.5 block text-[0.72rem] text-ink-muted">{ch.objectives.length} {pick(lang, "learning objectives", "শিখনফল")}</span>
                  </button>
                </li>
              ))}
            </ul>

            {chapter ? (
              <div className="mt-3 rounded-2xl bg-paper p-3">
                <h3 className="font-display text-[0.92rem] font-bold text-ink">{pick(lang, "Learning objectives — at the end of this chapter you will be able to:", "শিখনফল — অধ্যায় শেষে তুমি পারবে:")}</h3>
                <ul className="mt-1.5 list-disc pl-5 text-[0.85rem] leading-relaxed text-ink-soft">
                  {chapter.objectives.map((o) => <li key={o}>{o}</li>)}
                </ul>
                <h3 className="mt-3 font-display text-[0.92rem] font-bold text-ink">{pick(lang, "What do you want to learn?", "কী শিখতে চাও?")}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={concept === "whole"} onClick={() => setConcept("whole")} className={`rounded-full border-2 border-ink px-3 py-1.5 text-[0.8rem] font-bold ${concept === "whole" ? "bg-flame text-night" : "bg-white text-ink"}`}>
                    {pick(lang, "Whole chapter", "পুরো অধ্যায়")}
                  </button>
                  {chapter.subtopics.map((s) => (
                    <button key={s.id} type="button" aria-pressed={concept === s.id} onClick={() => setConcept(s.id)} className={`rounded-full border-2 border-ink px-3 py-1.5 text-[0.8rem] font-bold ${concept === s.id ? "bg-flame text-night" : "bg-white text-ink"}`}>
                      {s.title} · {pick(lang, `p. ${s.bookPage}`, `পৃ. ${s.bookPage}`)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.72rem] text-ink-muted">{pick(lang, `Source: ${chapter.source}`, `উৎস: ${chapter.source}`)}</p>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Teacher selection */}
      <section className={`${CARD} p-4`} aria-label={pick(lang, "AI Teacher selection", "AI শিক্ষক বাছাই")}>
        <h2 className="font-display text-[0.95rem] font-bold text-ink">{pick(lang, "AI Teacher Selection", "AI শিক্ষক বাছাই")}</h2>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {MATH_TEACHERS.map((t) => (
            <li key={t.id} className={`rounded-2xl border-2 border-ink p-3 ${teacherId === t.id ? "bg-marigold-soft shadow-hard-sm" : "bg-white"}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`grid size-14 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-xl font-bold ${t.color}`}>{(bn ? t.nameBn : t.name).charAt(0)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold text-ink">{pick(lang, t.name, t.nameBn)}</p>
                  <p className="text-[0.82rem] font-semibold text-brand-700">{t.styleLabel}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-soft">{t.trait}</p>
                  <p className="mt-1 flex items-center gap-1 text-[0.72rem] text-ink-muted"><Icon name="chat" className="size-3.5" strokeWidth={1.9} />{t.voice}</p>
                </div>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <button type="button" onClick={() => speak(t.previewLine, bn, t.id === "rakib" ? 1.05 : 0.9)} className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[0.78rem] font-bold text-ink hover:bg-paper">
                  <Icon name="play" className="size-3.5" />{pick(lang, "Preview", "শুনে দেখো")}
                </button>
                <button type="button" aria-pressed={teacherId === t.id} onClick={() => setTeacherId(t.id)} className={`rounded-full border-2 border-ink px-3 py-1.5 text-[0.78rem] font-bold ${teacherId === t.id ? "bg-flame text-night" : "bg-white text-ink"}`}>
                  {teacherId === t.id ? pick(lang, "Selected", "বাছাই হয়েছে") : pick(lang, "Select teacher", "শিক্ষক বাছাই করো")}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[0.95rem] font-bold text-ink">{pick(lang, "AI Classmate Selection", "AI সহপাঠী বাছাই")}</h2>
          <button type="button" onClick={() => setMates(MATH_CLASSMATES.map((c) => c.id))} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.75rem] font-bold text-ink hover:bg-paper">
            {pick(lang, "Select all three", "তিনজনকেই নাও")}
          </button>
          <span className="text-[0.78rem] font-semibold text-ink-muted">({mates.length}/3)</span>
        </div>
        <ul className="mt-2 grid gap-2 md:grid-cols-3">
          {MATH_CLASSMATES.map((c) => {
            const on = mates.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" aria-pressed={on} onClick={() => setMates((m) => on ? m.filter((x) => x !== c.id) : [...m, c.id])}
                  className={`flex h-full w-full items-start gap-2.5 rounded-2xl border-2 border-ink p-3 text-left ${on ? "bg-lagoon-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}>
                  <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink font-display text-lg font-bold ${c.color}`}>{c.name.charAt(0)}</span>
                  <span>
                    <span className="block font-display text-[0.98rem] font-bold text-ink">{c.name}</span>
                    <span className="block text-[0.78rem] font-semibold text-brand-700">{c.personality}</span>
                    <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-muted">{c.habit}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || !chapter || mates.length === 0} onClick={() => void startClass()} className={BTN}>
            <Icon name="play" className="size-4" />{lesson ? pick(lang, "Restart Class", "আবার ক্লাস শুরু") : pick(lang, "Start Class", "ক্লাস শুরু করো")}
          </button>
          <button type="button" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink shadow-hard-sm">
            <Icon name="chat" className="size-4" strokeWidth={1.9} />{voiceOn ? pick(lang, "Voice: On (browser)", "কণ্ঠ: চালু (ব্রাউজার)") : pick(lang, "Voice: Off", "কণ্ঠ: বন্ধ")}
          </button>
          {lesson ? <span className="text-[0.8rem] font-semibold text-ink-muted">{lesson.subject} · {conceptTitle}</span> : null}
        </div>
      </section>

      {/* Sources */}
      {lesson ? (
        <section className={`${CARD} p-4`} aria-label={pick(lang, "Textbook sources", "বইয়ের উৎস")}>
          <h2 className="flex items-center gap-2 font-display text-[0.95rem] font-bold text-ink"><Icon name="book" className="size-4.5 text-brand-600" strokeWidth={1.9} />{pick(lang, "From your NCTB textbook", "তোমার NCTB বই থেকে")}</h2>
          {missingSource || sources.length === 0 ? (
            <p role="alert" className="mt-2 rounded-xl border border-coral/40 bg-coral-soft px-3 py-2 text-sm font-medium text-shapla-ink">
              {pick(lang, "Textbook source missing for this topic. The lesson above teaches the chapter objective only and does not invent textbook exercises or page numbers. Run OCR ingestion (scripts/rag) to add full passages.", "এই টপিকের বইয়ের উৎস পাওয়া যায়নি। লেসনটি শুধু অধ্যায়ের শিখনফল শেখাচ্ছে, বইয়ের অনুশীলনী বা পৃষ্ঠা নম্বর বানানো হয়নি।")}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {sources.slice(0, 4).map((s) => (
                <li key={s.id} className="rounded-xl bg-paper px-3 py-2 text-[0.82rem] leading-snug text-ink-soft">
                  <span className="font-bold text-ink">{pick(lang, `Book p. ${s.bookPage}`, `বই পৃ. ${s.bookPage}`)} · {s.chapterTitle}</span> — {s.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Live class */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Whiteboard steps={boardSteps} title={lesson ? conceptTitle : pick(lang, "Your AI Teacher's Board", "তোমার AI শিক্ষকের বোর্ড")} subtitle={msgs[msgs.length - 1]?.text} />
          {lesson ? (
            <section className={`${CARD} p-4`}>
              <div className="flex flex-wrap gap-2">
                {lesson.explanations.map((e, i) => (
                  <button key={e.title} type="button" onClick={() => setStepIdx(i)} className={`rounded-full border-2 border-ink px-3 py-1 text-[0.8rem] font-bold ${i === stepIdx ? "bg-flame text-night" : "bg-white text-ink"}`}>{i + 1}. {e.title}</button>
                ))}
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-ink">{lesson.explanations[stepIdx]?.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{lesson.explanations[stepIdx]?.body}</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">{lesson.examples.map((x) => <li key={x}>{x}</li>)}</ul>
              <h3 className="mt-4 font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Checkpoint — try it yourself", "চেকপয়েন্ট — নিজে চেষ্টা করো")}</h3>
              {lesson.questions.map((q, qi) => (
                <div key={qi} className="mt-2 rounded-xl bg-paper p-3">
                  <p className="text-sm font-semibold text-ink">{q.question}</p>
                  {q.options.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((op) => (
                        <button key={op} type="button" onClick={() => answer(qi, op === q.answer)} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.8rem] font-bold text-ink hover:bg-marigold-soft">{op}</button>
                      ))}
                    </div>
                  ) : (
                    <button type="button" onClick={() => answer(qi, true)} className="mt-2 rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.8rem] font-bold text-ink">{pick(lang, "I can explain it", "আমি বোঝাতে পারব")}</button>
                  )}
                  <p className="mt-1 text-[0.78rem] text-ink-muted">{pick(lang, "Hint", "হিন্ট")}: {q.hint}</p>
                  {answerState[qi] !== undefined ? <p className={`text-[0.8rem] font-bold ${answerState[qi] ? "text-kolapata" : "text-shapla-ink"}`}>{answerState[qi] ? pick(lang, "Correct — nice work!", "সঠিক — দারুণ!") : pick(lang, `Not yet — answer: ${q.answer}`, `এখনো হয়নি — উত্তর: ${q.answer}`)}</p> : null}
                </div>
              ))}
              <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm font-medium text-ink"><strong>{pick(lang, "Summary:", "সারাংশ:")}</strong> {lesson.summary}</p>
            </section>
          ) : null}
        </div>

        <section className={`${CARD} flex max-h-[42rem] flex-col p-3`} aria-label={pick(lang, "Class chat", "ক্লাসের আলোচনা")}>
          <h2 className="flex items-center gap-2 px-1 font-display text-[0.95rem] font-bold text-ink"><Icon name="chat" className="size-4.5 text-brand-600" strokeWidth={1.9} />{pick(lang, "Class Discussion", "ক্লাসের আলোচনা")}</h2>
          <ul className="mt-2 flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto px-1">
            {msgs.length === 0 ? <li className="text-sm text-ink-muted">{pick(lang, "Your teacher and classmates will talk here. Press Start Class.", "শিক্ষক ও সহপাঠীরা এখানে কথা বলবে। Start Class চাপো।")}</li> : null}
            {msgs.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink text-[0.72rem] font-bold ${m.color}`}>{m.who.charAt(0)}</span>
                <span className="min-w-0"><span className="block text-[0.72rem] font-bold text-ink-muted">{m.who}</span><span className="block text-[0.85rem] leading-snug text-ink">{m.text}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-1.5 border-t border-paper-edge pt-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={pick(lang, "Ask or answer…", "প্রশ্ন করো বা উত্তর দাও…")} className="h-10 min-w-0 flex-1 rounded-full border-2 border-ink bg-paper px-3 text-sm text-ink outline-none" />
            <button type="button" onClick={listen} className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink" aria-label={pick(lang, "Speak", "বলে বলো")}><Icon name="chat" className="size-4" strokeWidth={1.9} /></button>
            <button type="button" disabled={busy || !input.trim()} onClick={send} className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-flame text-night disabled:opacity-50" aria-label={pick(lang, "Send", "পাঠাও")}><Icon name="send" className="size-4" strokeWidth={2} /></button>
          </div>
          <button type="button" disabled={busy || !lesson} onClick={() => void nextTurn()} className={`${BTN} mt-2 w-full`}>
            {busy ? pick(lang, "Thinking…", "ভাবছে…") : pick(lang, "Continue Class", "ক্লাস চালিয়ে যাও")}
          </button>
        </section>
      </div>
    </div>
  );
}
