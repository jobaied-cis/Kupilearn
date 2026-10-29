"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Whiteboard } from "./Whiteboard";
import { pick, useLang } from "../../lib/i18n";
import { NCTB_CATALOG, getClass } from "../../lib/nctb/catalog";
import { CLASSMATES, TEACHERS, buildRegistry } from "../../lib/classroom/catalog";
import type { StructuredLesson, VizInstruction } from "../../lib/lesson/engine";
import { adaptLearner, recordAnswer } from "../../lib/learner/adapt";
import { loadLearner, saveLearner } from "../../lib/learner/store";
import type { ClassroomTurnResponse } from "../../lib/classroom/types";

type Msg = { who: string; role: string; text: string; color: string };
const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:opacity-50";

function speak(text: string, bn: boolean) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 220));
    u.lang = bn ? "bn-BD" : "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* speech is optional */ }
}

export function ClassroomLive() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [classLevel, setClassLevel] = useState(6);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [teacherId, setTeacherId] = useState(TEACHERS[0]!.id);
  const [mates, setMates] = useState<string[]>([CLASSMATES[0]!.id, CLASSMATES[1]!.id]);
  const [lesson, setLesson] = useState<StructuredLesson | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [answerState, setAnswerState] = useState<Record<number, boolean>>({});
  const turnState = useRef<unknown>(null);
  const registryRef = useRef<unknown>(null);

  const cls = getClass(classLevel);
  const subject = cls?.subjects.find((s) => s.id === subjectId) ?? cls?.subjects[0];
  const chapter = subject?.chapters.find((c) => c.id === chapterId) ?? subject?.chapters[0];
  const topic = chapter?.topics.find((t) => t.id === topicId) ?? chapter?.topics[0];

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = loadLearner();
      if (p.classLevel >= 6 && p.classLevel <= 10) setClassLevel(p.classLevel);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const boardSteps: VizInstruction[] = lesson
    ? lesson.explanations.slice(0, stepIdx + 1).flatMap((e) => e.board)
    : topic ? [{ kind: "write", content: pick(lang, topic.title, topic.titleBn) }, { kind: "highlight", content: topic.objective }] : [];

  async function startClass() {
    if (!subject || !chapter || !topic) return;
    setBusy(true);
    try {
      const learner = loadLearner();
      const adaptation = adaptLearner(learner);
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classLevel, topicId: topic.id, language: lang, difficulty: adaptation.difficulty }),
      });
      const data = (await res.json()) as { lesson: StructuredLesson; degraded: boolean };
      setLesson(data.lesson);
      setDegraded(!!data.degraded);
      setStepIdx(0);
      setAnswerState({});
      registryRef.current = buildRegistry({ teacherId, classmateIds: mates, classLevel, subject: subject.title, topicTitle: topic.title });
      turnState.current = null;
      const teacher = TEACHERS.find((t) => t.id === teacherId);
      const intro = data.lesson.introduction;
      setMsgs([{ who: teacher?.name ?? "Teacher", role: "teacher", text: intro, color: "bg-flame text-night" }]);
      if (voiceOn) speak(intro, bn);
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
        body: JSON.stringify({
          registry: registryRef.current,
          state: turnState.current ?? undefined,
          student_input: studentInput,
          student_answer_correct: correct ?? null,
        }),
      });
      const data = (await res.json()) as ClassroomTurnResponse;
      turnState.current = data.state;
      registryRef.current = data.registry;
      if (data.turn) {
        const turn = data.turn;
        const card = CLASSMATES.find((c) => turn.speaker.display_name === c.name);
        const tcard = TEACHERS.find((t) => t.name === turn.speaker.display_name);
        setMsgs((m) => [...m.slice(-29), { who: turn.speaker.display_name, role: turn.speaker.role, text: turn.content.text, color: card?.color ?? tcard?.color ?? "bg-brand-50 text-brand-700" }]);
        if (voiceOn) speak(turn.content.text, bn);
      }
    } catch {
      setMsgs((m) => [...m, { who: "Kupi", role: "teacher", text: pick(lang, "The class connection paused. Your lesson is saved here — try Continue.", "ক্লাসের সংযোগ থেমেছে। লেসন এখানেই আছে — Continue চাপো।"), color: "bg-flame text-night" }]);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { who: pick(lang, "You", "তুমি"), role: "student", text, color: "bg-night text-paper" }]);
    saveLearner({ ...loadLearner(), classLevel, interactions: loadLearner().interactions + 1 });
    void nextTurn(text);
  }

  function answer(qIdx: number, correct: boolean) {
    setAnswerState((s) => ({ ...s, [qIdx]: correct }));
    saveLearner(recordAnswer(loadLearner(), correct, topic?.id));
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
        <h1 className="text-[clamp(1.35rem,3vw,1.8rem)] leading-tight text-ink">{pick(lang, "AI Classroom", "AI ক্লাসরুম")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, "Pick your class, subject, teacher and classmates — your AI teacher teaches on the board, step by step.", "ক্লাস, বিষয়, শিক্ষক আর সহপাঠী বেছে নাও — AI শিক্ষক বোর্ডে ধাপে ধাপে পড়াবে।")}</p>
      </div>

      {degraded ? (
        <p role="status" className="rounded-xl border border-marigold/60 bg-marigold-soft px-3 py-2 text-sm font-medium text-ember-ink">
          {pick(lang, "Offline lesson mode: Meta is not configured on the server yet, so a built-in NCTB lesson is used. Add META_API_KEY, META_API_BASE_URL and model IDs in .env.local to go live.", "অফলাইন লেসন মোড: সার্ভারে Meta এখনো কনফিগার হয়নি, তাই বিল্ট-ইন NCTB লেসন চলছে। লাইভ করতে .env.local-এ META_API_KEY, META_API_BASE_URL ও মডেল ID বসাও।")}
        </p>
      ) : null}

      {/* Setup */}
      <section className={`${CARD} p-4`} aria-label={pick(lang, "Class setup", "ক্লাস সাজানো")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-[0.8rem] font-bold text-ink">{pick(lang, "Class", "শ্রেণি")}
            <select className={sel} value={classLevel} onChange={(e) => { setClassLevel(Number(e.target.value)); setSubjectId(""); setChapterId(""); setTopicId(""); }}>
              {NCTB_CATALOG.map((c) => <option key={c.classLevel} value={c.classLevel}>{pick(lang, `Class ${c.classLevel}`, `শ্রেণি ${c.classLevel}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] font-bold text-ink">{pick(lang, "Subject", "বিষয়")}
            <select className={sel} value={subject?.id ?? ""} onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); setTopicId(""); }}>
              {cls?.subjects.map((s) => <option key={s.id} value={s.id}>{pick(lang, s.title, s.titleBn)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] font-bold text-ink">{pick(lang, "Chapter", "অধ্যায়")}
            <select className={sel} value={chapter?.id ?? ""} onChange={(e) => { setChapterId(e.target.value); setTopicId(""); }}>
              {subject?.chapters.map((c) => <option key={c.id} value={c.id}>{pick(lang, c.title, c.titleBn)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] font-bold text-ink">{pick(lang, "Topic", "টপিক")}
            <select className={sel} value={topic?.id ?? ""} onChange={(e) => setTopicId(e.target.value)}>
              {chapter?.topics.map((t) => <option key={t.id} value={t.id}>{pick(lang, t.title, t.titleBn)}</option>)}
            </select>
          </label>
        </div>

        <h2 className="mt-4 font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Choose your AI Teacher", "তোমার AI শিক্ষক বেছে নাও")}</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TEACHERS.map((t) => (
            <li key={t.id}>
              <button type="button" aria-pressed={teacherId === t.id} onClick={() => setTeacherId(t.id)} className={`flex w-full items-center gap-2.5 rounded-2xl border-2 border-ink p-3 text-left ${teacherId === t.id ? "bg-marigold-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}>
                <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink font-display font-bold ${t.color}`}>{(bn ? t.nameBn : t.name).charAt(0)}</span>
                <span><span className="block font-display text-[0.95rem] font-bold text-ink">{pick(lang, t.name, t.nameBn)}</span><span className="block text-[0.75rem] font-semibold text-brand-700">{t.styleLabel}</span><span className="block text-[0.72rem] text-ink-muted">{t.trait}</span></span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="mt-4 font-display text-[0.95rem] font-bold text-ink">{pick(lang, "Choose up to 4 AI Classmates", "সর্বোচ্চ ৪ জন AI সহপাঠী বেছে নাও")} <span className="text-ink-muted">({mates.length}/4)</span></h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CLASSMATES.map((c) => {
            const on = mates.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" aria-pressed={on} onClick={() => setMates((m) => on ? m.filter((x) => x !== c.id) : m.length >= 4 ? m : [...m, c.id])} className={`flex w-full items-center gap-2.5 rounded-2xl border-2 border-ink p-3 text-left ${on ? "bg-lagoon-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}>
                  <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink font-display font-bold ${c.color}`}>{c.name.charAt(0)}</span>
                  <span><span className="block font-display text-[0.95rem] font-bold text-ink">{c.name} · {c.personality}</span><span className="block text-[0.72rem] text-ink-muted">{c.habit}</span></span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || mates.length === 0} onClick={() => void startClass()} className={BTN}>
            <Icon name="play" className="size-4" />{lesson ? pick(lang, "Restart Class", "আবার ক্লাস শুরু") : pick(lang, "Start Class", "ক্লাস শুরু করো")}
          </button>
          <button type="button" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink shadow-hard-sm">
            <Icon name="chat" className="size-4" strokeWidth={1.9} />{voiceOn ? pick(lang, "Voice: On (browser)", "কণ্ঠ: চালু (ব্রাউজার)") : pick(lang, "Voice: Off", "কণ্ঠ: বন্ধ")}
          </button>
          {lesson ? <span className="text-[0.8rem] font-semibold text-ink-muted">{lesson.subject} · {lesson.chapter} · {lesson.topic}</span> : null}
        </div>
      </section>

      {/* Live class */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Whiteboard steps={boardSteps} title={lesson ? lesson.topic : pick(lang, "Your AI Teacher's Board", "তোমার AI শিক্ষকের বোর্ড")} subtitle={msgs[msgs.length - 1]?.text} />
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

        {/* Chat / people */}
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
