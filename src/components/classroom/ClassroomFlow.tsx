"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { LiveClass } from "./LiveClass";
import { speakDurationMs, type ClassSpeed } from "../../lib/classroom/schedule";
import { primeVoices, speakAsCharacter } from "../../lib/classroom/voices";
import { AnimatedAvatar } from "./AnimatedAvatar";
import { CLASS_LEVELS, booksForClass, type Book, type BookChapter } from "../../lib/classroom/books";
import { CLASSMATES, TEACHERS, buildRegistry, type ClassmateCard, type TeacherCard } from "../../lib/classroom/catalog";
import type { StructuredLesson } from "../../lib/lesson/engine";
import type { RetrievedPassage } from "../../lib/rag/retrieve";
import { adaptLearner, recordAnswer } from "../../lib/learner/adapt";
import { loadLearner, saveLearner } from "../../lib/learner/store";
import { generateHomeworkFromTopic } from "../../lib/homework/engine";
import { addAssignment, loadAssignments } from "../../lib/homework/store";
import { createCheckpointReporter } from "../../lib/revision/client";
import { conceptIdForTopicId } from "../../lib/revision/concepts";
import type { ClassroomTurnResponse } from "../../lib/classroom/types";

type Step = "class" | "book" | "chapter" | "teacher" | "classmates" | "live" | "progress";
type Phase = "teach" | "discuss" | "respond" | "checkpoint" | "praised" | "reteach";
type Msg = { who: string; role: string; text: string; color: string };

const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-flame px-5 py-2.5 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GHOST = "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50";
const STEP_LABELS: Record<Step, string> = {
  class: "1. Class",
  book: "2. Book",
  chapter: "3. Chapter",
  teacher: "4. Teacher",
  classmates: "5. Classmates",
  live: "6. Live Class",
  progress: "Progress",
};

function speak(text: string, who = "Teacher") {
  // Unique voice per character (browser TTS — Meta has no TTS model here).
  speakAsCharacter(who, text, 1);
}

function StepBar({ step }: { step: Step }) {
  const steps = Object.keys(STEP_LABELS) as Step[];
  const idx = steps.indexOf(step);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Classroom steps">
      {steps.map((s, i) => (
        <li key={s} aria-current={s === step ? "step" : undefined} className={`rounded-full border-2 border-ink px-3 py-1 text-[0.75rem] font-bold ${i < idx ? "bg-kolapata-soft text-kolapata" : s === step ? "bg-flame text-night" : "bg-white text-ink-muted"}`}>
          {STEP_LABELS[s]}
        </li>
      ))}
    </ol>
  );
}

export function ClassroomFlow() {
  const [step, setStep] = useState<Step>("class");
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<BookChapter | null>(null);
  const [teacher, setTeacher] = useState<TeacherCard | null>(null);
  const [mates, setMates] = useState<ClassmateCard[]>([]);

  const [lesson, setLesson] = useState<StructuredLesson | null>(null);
  const [sources, setSources] = useState<RetrievedPassage[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [provider, setProvider] = useState<string>("offline");
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("teach");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [openAnswer, setOpenAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [reteachCount, setReteachCount] = useState(0);
  const [hwAssigned, setHwAssigned] = useState(false);
  const turnState = useRef<unknown>(null);
  const registryRef = useRef<unknown>(null);
  // Automatic live-class engine state.
  const [speed, setSpeed] = useState<ClassSpeed>(1);
  const [paused, setPaused] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<{ who: string; text: string } | null>(null);
  const runRef = useRef(0);
  const speedRef = useRef<number>(1);
  const pausedRef = useRef(false);
  const voiceRef = useRef(true);
  const startedLessonRef = useRef<string | null>(null);
  const [checkpointReporter] = useState(() => createCheckpointReporter());

  /**
   * Report a checkpoint answer to the Revision Engine. The only reliable
   * concept mapping is chapter.topicId (the NCTB topic this lesson was
   * generated from); lesson.id is NOT used (it can be a textbook chapter
   * id). With no reliable mapping, no mastery record is created.
   */
  function reportCheckpointAttempt(isCorrect: boolean, studentAnswer: string) {
    if (!question) return;
    const conceptId = conceptIdForTopicId(chapter?.topicId);
    if (!conceptId) {
      console.warn(`[revision] No NCTB concept mapping for chapter ${chapter?.id ?? "unknown"} (topicId: ${chapter?.topicId ?? "none"}, mathChapterId: ${chapter?.mathChapterId ?? "none"}); revision attempt skipped.`);
      return;
    }
    checkpointReporter({ conceptId, stepIdx, question: question.question, isCorrect, studentAnswer });
  }

  const books = classLevel ? booksForClass(classLevel) : [];
  const [topicImages, setTopicImages] = useState<Record<number, string | null>>({});
  const boardSections = lesson ? lesson.explanations.map((e, i) => ({ title: e.title, steps: e.board, image: topicImages[i] ?? null })) : [];

  // One Meta-generated visualization per topic, fetched as the topic begins.
  useEffect(() => {
    if (step !== "live" || !lesson || !chapter) return;
    if (topicImages[stepIdx] !== undefined) return;
    const exp = lesson.explanations[stepIdx];
    if (!exp) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/classroom/image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: `${chapter.title} — ${exp.title}: ${exp.body.slice(0, 320)}` }),
        });
        const data = (await res.json()) as { image: string | null };
        if (!cancelled) setTopicImages((m) => ({ ...m, [stepIdx]: data.image }));
      } catch {
        if (!cancelled) setTopicImages((m) => ({ ...m, [stepIdx]: null }));
      }
    })();
    return () => { cancelled = true; };
  }, [step, lesson, chapter, stepIdx, topicImages]);
  const question = lesson ? lesson.questions[stepIdx % lesson.questions.length] : null;
  const isLastStep = lesson ? stepIdx >= lesson.explanations.length - 1 : false;
  const accuracy = attempts ? Math.round((correctCount / attempts) * 100) : 0;

  function say(who: string, role: string, text: string, color: string, _rate?: number) {
    void _rate; // each character's own voice profile sets pitch/rate now
    setMsgs((m) => [...m.slice(-29), { who, role, text, color }]);
    setSubtitle({ who, text });
    setActiveSpeaker(who);
    if (voiceRef.current) speakAsCharacter(who, text, speedRef.current);
  }

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { voiceRef.current = voiceOn; if (!voiceOn) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } } }, [voiceOn]);

  /** Sleep that respects Pause and is cancelled when the run token changes. */
  async function sleep(ms: number, token: number): Promise<boolean> {
    let elapsed = 0;
    while (elapsed < ms) {
      if (runRef.current !== token) return false;
      if (!pausedRef.current) elapsed += 200;
      await new Promise((r) => setTimeout(r, 200));
    }
    return runRef.current === token;
  }

  async function waitForSpeech(text: string, token: number): Promise<boolean> {
    const ok = await sleep(speakDurationMs(text, speedRef.current), token);
    if (ok) setActiveSpeaker(null);
    return ok;
  }

  const lastTurnRoleRef = useRef<string | null>(null);

  async function nextTurn(studentInput?: string, correct?: boolean | null, topic?: { title: string; keywords: string[]; summary: string }): Promise<string | null> {
    if (!registryRef.current || !teacher) return null;
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
          topic,
          adaptation: correct === false
            ? { learner_emotion: "confused", learner_comprehension: "low", last_checkpoint: "failed" }
            : { learner_emotion: "calm", learner_comprehension: "medium", last_checkpoint: correct ? "passed" : "not_attempted" },
        }),
      });
      const data = (await res.json()) as ClassroomTurnResponse;
      turnState.current = data.state;
      registryRef.current = data.registry;
      if (data.turn) {
        const t = data.turn;
        const card = CLASSMATES.find((c) => t.speaker.display_name === c.name);
        const tcard = TEACHERS.find((x) => x.name === t.speaker.display_name);
        lastTurnRoleRef.current = t.speaker.role;
        say(t.speaker.display_name, t.speaker.role, t.content.text, card?.color ?? tcard?.color ?? "bg-brand-50 text-brand-700", t.speaker.display_name === teacher.name && teacher.id === "rakib" ? 1.05 : 0.95);
        return t.content.text;
      }
      return null;
    } catch {
      setMsgs((m) => [...m, { who: "Kupi", role: "teacher", text: "The class connection paused for a moment. The lesson will continue.", color: "bg-flame text-night" }]);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startClass() {
    if (!classLevel || !book || !chapter || !teacher || mates.length === 0) return;
    primeVoices();
    setStarting(true);
    setError("");
    try {
      const adaptation = adaptLearner(loadLearner());
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classLevel,
          topicId: chapter.topicId,
          chapterId: chapter.mathChapterId,
          query: chapter.title,
          language: "en",
          difficulty: adaptation.difficulty,
        }),
      });
      if (!res.ok) throw new Error("Lesson failed to load");
      const data = (await res.json()) as { lesson: StructuredLesson; degraded: boolean; provider: string; sources: RetrievedPassage[] };
      setLesson(data.lesson);
      setDegraded(!!data.degraded);
      setProvider(data.provider ?? "offline");
      setSources(data.sources ?? []);
      setStepIdx(0);
      setPhase("teach");
      setAttempts(0);
      setCorrectCount(0);
      setReteachCount(0);
      registryRef.current = buildRegistry({ teacherId: teacher.id, classmateIds: mates.map((m) => m.id), classLevel, subject: book.title, topicTitle: chapter.title });
      turnState.current = null;
      setMsgs([]);
      setTopicImages({});
      setSubtitle(null);
      setActiveSpeaker(null);
      setPaused(false);
      startedLessonRef.current = null;
      // Entering "live" starts the automatic class (see the effect below).
      setStep("live");
    } catch {
      setError("We could not start the class. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  /**
   * The automatic class for one topic: teacher teaches on the board,
   * a classmate asks/reacts in character, the teacher responds, and only
   * then does the class stop — for the student's checkpoint answer.
   */
  async function runTopic(idx: number, from: "teach" | "discuss" = "teach") {
    if (!lesson || !teacher) return;
    const token = ++runRef.current;
    const exp = lesson.explanations[idx];
    if (!exp) return;
    if (from === "teach") {
      setPhase("teach");
      const intro = idx === 0 ? `${lesson.introduction} ` : "";
      const teachText = `${intro}${exp.title}. ${exp.body}`;
      say(teacher.name, "teacher", teachText, teacher.color, teacher.id === "rakib" ? 1.05 : 0.9);
      if (!(await waitForSpeech(teachText, token))) return;
    }
    // A classmate asks a question about THIS topic (title + key words from
    // the board), in their personality; then the teacher responds to it.
    const topic = {
      title: exp.title,
      keywords: exp.board.map((b) => b.content).slice(0, 6),
      summary: exp.body.slice(0, 400),
    };
    setPhase("discuss");
    let mateText: string | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      mateText = await nextTurn(undefined, null, topic);
      if (runRef.current !== token) return;
      if (mateText && !(await waitForSpeech(mateText, token))) return;
      if (lastTurnRoleRef.current === "classmate") break;
    }
    setPhase("respond");
    const replyText = await nextTurn(undefined, null, topic);
    if (runRef.current !== token) return;
    if (replyText) {
      if (!(await waitForSpeech(replyText, token))) return;
    } else if (mateText) {
      // The Director often hands the floor to the student after a classmate
      // question. In the automatic class the teacher still answers the
      // classmate first, in their own voice, before asking the student.
      const answer = `Good question — let me answer that. ${exp.body.split(".")[0]}. Keep that picture of ${topic.keywords[0] ?? exp.title} in mind.`;
      say(teacher.name, "teacher", answer, teacher.color, teacher.id === "rakib" ? 1.05 : 0.9);
      if (!(await waitForSpeech(answer, token))) return;
    }
    // Stop the automatic run: the teacher asks the student.
    const q = lesson.questions[idx % lesson.questions.length];
    setPhase("checkpoint");
    if (q) {
      const askText = `Now your turn. ${q.question}`;
      say(teacher.name, "teacher", askText, teacher.color, 0.95);
      void waitForSpeech(askText, token);
    }
  }

  // Start (or restart) the automatic class when the live stage opens.
  useEffect(() => {
    if (step !== "live" || !lesson || !teacher) return;
    if (startedLessonRef.current === lesson.id) return;
    startedLessonRef.current = lesson.id;
    void runTopic(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lesson, teacher]);

  // Leaving the live stage cancels the automatic run and any speech.
  useEffect(() => {
    if (step === "live") return;
    runRef.current += 1;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }, [step]);

  function reteachText(): string {
    if (!lesson || !question) return "";
    const examples = lesson.examples.length ? lesson.examples : [lesson.summary];
    const example = examples[reteachCount % examples.length];
    const current = lesson.explanations[stepIdx];
    const styles = [
      `No problem at all — let's see it in a completely different way. ${example} Now connect it back: ${current?.body.split(".")[0]}.`,
      `Let's try another real-life picture instead. ${example} Hint to hold on to: ${question.hint}`,
      `Smallest step this time, slowly. ${current?.body} One clue before you retry: ${question.hint}`,
    ];
    return styles[Math.min(reteachCount, styles.length - 1)] ?? styles[0]!;
  }

  async function answerCorrect() {
    if (!teacher || !question || !lesson) return;
    const token = ++runRef.current;
    setAttempts((n) => n + 1);
    setCorrectCount((n) => n + 1);
    saveLearner(recordAnswer(loadLearner(), true, chapter?.id));
    reportCheckpointAttempt(true, question.answer);
    setPhase("praised");
    const praise = `Excellent work! You understood "${lesson.explanations[stepIdx]?.title}" — that is exactly right. I am proud of you. ${isLastStep ? "That was the last topic of this chapter." : "Let us move to the next topic."}`;
    say(teacher.name, "teacher", praise, teacher.color, teacher.id === "rakib" ? 1.05 : 0.9);
    if (!(await waitForSpeech(praise, token))) return;
    await nextTurn(undefined, true);
    if (runRef.current !== token) return;
    if (isLastStep) { setStep("progress"); return; }
    const next = stepIdx + 1;
    setStepIdx(next);
    void runTopic(next);
  }

  function answerWrong(picked: string) {
    if (!teacher) return;
    const token = ++runRef.current;
    setAttempts((n) => n + 1);
    saveLearner(recordAnswer(loadLearner(), false, chapter?.id));
    reportCheckpointAttempt(false, picked);
    const text = reteachText();
    setReteachCount((n) => n + 1);
    setPhase("reteach");
    const reteach = `"${picked}" is a good try, but not quite. ${text} Listen once more, then I will ask you again.`;
    say(teacher.name, "teacher", reteach, teacher.color, 0.9);
    void (async () => {
      if (!(await waitForSpeech(reteach, token))) return;
      await nextTurn(undefined, false);
      if (runRef.current !== token || !question) return;
      setPhase("checkpoint");
      const askText = `Try again, slowly. ${question.question}`;
      say(teacher.name, "teacher", askText, teacher.color, 0.95);
      void waitForSpeech(askText, token);
    })();
  }

  function answerOpen() {
    if (!question) return;
    const given = openAnswer.trim().toLowerCase();
    if (!given) return;
    const answerWords = question.answer.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const hit = answerWords.some((w) => given.includes(w)) || given.length > 24;
    setOpenAnswer("");
    if (hit) answerCorrect();
    else answerWrong(openAnswer.trim());
  }

  async function handleSpeech(audioBase64: string, format: string) {
    try {
      const res = await fetch("/api/classroom/stt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio: audioBase64, format }),
      });
      const data = (await res.json()) as { text: string | null };
      const heard = (data.text ?? "").trim();
      if (heard) void sendText(heard);
      else if (teacher) say(teacher.name, "teacher", "I could not hear that clearly. Please try speaking again, or type your question.", teacher.color, 0.95);
    } catch {
      if (teacher) say(teacher.name, "teacher", "Voice transcription is unavailable right now. Please type your question.", teacher.color, 0.95);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendText(text);
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { who: "You", role: "student", text, color: "bg-night text-paper" }]);
    const p = loadLearner();
    saveLearner({ ...p, interactions: p.interactions + 1 });
    // Interrupt the automatic flow: the teacher answers the student's
    // question, then the class continues from the discussion stage.
    const wasCheckpoint = phase === "checkpoint";
    const token = ++runRef.current;
    const reply = await nextTurn(text);
    if (runRef.current !== token) return;
    if (reply) await waitForSpeech(reply, token);
    if (runRef.current !== token) return;
    if (wasCheckpoint && question && teacher) {
      const askText = `Back to my question. ${question.question}`;
      say(teacher.name, "teacher", askText, teacher.color, 0.95);
      void waitForSpeech(askText, token);
    } else if (phase !== "praised") {
      void runTopic(stepIdx, "discuss");
    }
  }

  function downloadNotes() {
    if (!lesson || !chapter || !book || !teacher) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Class Notes — ${esc(chapter.title)}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111;line-height:1.55}h1{font-size:26px}h2{margin-top:26px;font-size:19px}li{margin:4px 0}.meta{color:#555;font-size:13px}@media print{button{display:none}}</style></head><body>`
      + `<h1>${esc(chapter.title)} — Class Notes</h1><p class="meta">Class ${classLevel} · ${esc(book.title)} · Teacher: ${esc(teacher.name)} · Classmates: ${mates.map((m) => esc(m.name)).join(", ")} · Score: ${correctCount}/${attempts} (${accuracy}%)</p>`
      + `<p>${esc(lesson.introduction)}</p>`
      + lesson.explanations.map((e, i) => `<h2>${i + 1}. ${esc(e.title)}</h2><p>${esc(e.body)}</p><ul>${e.board.map((b) => `<li><em>Board:</em> ${esc(b.content)}</li>`).join("")}</ul>`).join("")
      + `<h2>Examples</h2><ul>${lesson.examples.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
      + `<h2>Checkpoint Questions</h2><ol>${lesson.questions.map((q) => `<li>${esc(q.question)}<br><strong>Answer:</strong> ${esc(q.answer)}<br><em>Hint:</em> ${esc(q.hint)}</li>`).join("")}</ol>`
      + `<h2>Summary</h2><p>${esc(lesson.summary)}</p>`
      + (sources.length ? `<h2>Textbook Sources</h2><ul>${sources.map((s) => `<li>Book p. ${s.bookPage} · ${esc(s.chapterTitle)} — ${esc(s.text)}</li>`).join("")}</ul>` : "")
      + `<button onclick="window.print()">Print / Save as PDF</button><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function resetFlow(to: Step) {
    setStep(to);
    setHwAssigned(false);
    if (to === "class") { setBook(null); setChapter(null); setTeacher(null); setMates([]); setLesson(null); }
    if (to === "book") { setChapter(null); setTeacher(null); setMates([]); setLesson(null); }
    if (to === "chapter") { setTeacher(null); setMates([]); setLesson(null); }
  }

  // Lesson completion → tonight's homework, generated from the lesson topic.
  function assignLessonHomework() {
    if (!lesson || !classLevel || hwAssigned) return;
    try {
      const assignment = generateHomeworkFromTopic({
        classLevel,
        topicId: lesson.id,
        dueBucket: "tonight",
        source: "lesson",
        now: new Date(),
      });
      addAssignment(loadAssignments(classLevel), assignment);
      setHwAssigned(true);
    } catch {
      // Topic not in the NCTB catalog (e.g. free-form lesson) — no homework.
    }
  }

  return (
    <div className="mx-auto flex max-w-[84rem] flex-col gap-4">
      <div>
        <h1 className="text-[clamp(1.35rem,3vw,1.8rem)] leading-tight text-ink">AI Classroom</h1>
        <p className="mt-1 text-sm text-ink-soft">Lessons, step by step — choose your class, book and chapter, meet your AI teacher and classmates, then learn together in English.</p>
      </div>
      <StepBar step={step} />
      {error ? <p role="alert" className="rounded-xl border border-coral/40 bg-coral-soft px-3 py-2 text-sm font-medium text-shapla-ink">{error}</p> : null}

      {step === "class" ? (
        <section className={`${CARD} p-5`} aria-label="Select your class">
          <h2 className="font-display text-xl font-bold text-ink">Which class are you in?</h2>
          <p className="mt-1 text-sm text-ink-soft">Select your class to see your books.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {CLASS_LEVELS.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => { setClassLevel(c); setBook(null); setChapter(null); setStep("book"); }} className="w-full rounded-2xl border-2 border-ink bg-paper px-4 py-6 text-center transition-transform hover:-translate-y-0.5 hover:bg-marigold-soft">
                  <span className="block font-display text-3xl font-bold text-ink">Class {c}</span>
                  <span className="mt-1 block text-[0.8rem] font-semibold text-ink-muted">{booksForClass(c).length} books</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === "book" && classLevel ? (
        <section className={`${CARD} p-5`} aria-label="Select a book">
          <h2 className="font-display text-xl font-bold text-ink">Your Class {classLevel} books</h2>
          <p className="mt-1 text-sm text-ink-soft">Pick a book to see its chapters.</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => { setBook(b); setChapter(null); setStep("chapter"); }} className="h-full w-full rounded-2xl border-2 border-ink bg-white p-4 text-left hover:bg-paper">
                  <span className="grid size-11 place-items-center rounded-xl border-2 border-ink bg-flame font-display text-lg font-bold text-night">{b.title.charAt(0)}</span>
                  <span className="mt-2 block font-display text-lg leading-snug font-bold text-ink">{b.title}</span>
                  <span className="mt-0.5 block text-[0.82rem] text-ink-muted">{b.chapters.length} chapters · Class {classLevel}</span>
                  <span className="mt-1 block text-[0.72rem] text-ink-muted">{b.sourceLabel}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={`${BTN_GHOST} mt-4`} onClick={() => resetFlow("class")}>Back to class selection</button>
        </section>
      ) : null}

      {step === "chapter" && book ? (
        <section className={`${CARD} p-5`} aria-label="Select a chapter">
          <h2 className="font-display text-xl font-bold text-ink">{book.title} — chapters</h2>
          <p className="mt-1 text-sm text-ink-soft">Class {classLevel} · {book.sourceLabel}. Pick a chapter to start learning.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {book.chapters.map((ch) => (
              <li key={ch.id}>
                <button type="button" onClick={() => { setChapter(ch); setStep("teacher"); }} className="h-full w-full rounded-2xl border-2 border-ink bg-white p-3.5 text-left hover:bg-marigold-soft">
                  <span className="flex items-center justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-full border-2 border-ink bg-flame font-display text-sm font-bold text-night">{ch.number}</span>
                    {ch.bookPage ? <span className="text-[0.7rem] font-bold text-ink-muted">Book p. {ch.bookPage}</span> : null}
                  </span>
                  <span className="mt-2 block font-display text-[0.98rem] leading-snug font-bold text-ink">{ch.title}</span>
                  <span className="mt-0.5 block text-[0.75rem] text-ink-muted">{ch.objectives.length} learning objectives</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={`${BTN_GHOST} mt-4`} onClick={() => resetFlow("book")}>Back to books</button>
        </section>
      ) : null}

      {step === "teacher" && chapter ? (
        <section className={`${CARD} p-5`} aria-label="Select your AI teacher">
          <h2 className="font-display text-xl font-bold text-ink">Choose your AI Teacher</h2>
          <p className="mt-1 text-sm text-ink-soft">For {chapter.title}. Listen to a preview, then select one teacher.</p>
          <ul className="mt-4 grid gap-2.5 md:grid-cols-2">
            {TEACHERS.map((t) => (
              <li key={t.id} className={`rounded-2xl border-2 border-ink p-4 ${teacher?.id === t.id ? "bg-marigold-soft shadow-hard-sm" : "bg-white"}`}>
                <div className="flex items-start gap-3">
                  <span className="shrink-0"><AnimatedAvatar name={t.name} color={t.color} gender={t.gender} speaking={false} /></span>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-ink">{t.name} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[0.65rem] font-bold ${t.gender === "female" ? "bg-coral-soft text-shapla-ink" : "bg-lagoon-soft text-padma-ink"}`}>{t.gender === "female" ? "Female" : "Male"}</span></p>
                    <p className="text-[0.82rem] font-semibold text-brand-700">{t.styleLabel}</p>
                    <p className="mt-0.5 text-[0.82rem] leading-snug text-ink-soft">{t.trait}</p>
                    <p className="mt-1 text-[0.72rem] text-ink-muted">{t.voice}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => speak(t.previewLine, t.name)} className={BTN_GHOST}><Icon name="play" className="size-3.5" /> Preview voice</button>
                  <button type="button" aria-pressed={teacher?.id === t.id} onClick={() => setTeacher(t)} className={teacher?.id === t.id ? BTN : BTN_GHOST}>{teacher?.id === t.id ? "Selected" : "Select teacher"}</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => resetFlow("chapter")}>Back to chapters</button>
            <button type="button" className={BTN} disabled={!teacher} onClick={() => setStep("classmates")}>Continue to classmates <Icon name="arrow" className="size-4" strokeWidth={2.2} /></button>
          </div>
        </section>
      ) : null}

      {step === "classmates" && teacher && chapter ? (
        <section className={`${CARD} p-5`} aria-label="Select your AI classmates">
          <h2 className="font-display text-xl font-bold text-ink">Choose your AI Classmates</h2>
          <p className="mt-1 text-sm text-ink-soft">{teacher.name} will teach {chapter.title}. Pick 1 to 3 classmates — each one asks questions and reacts in their own way during the lesson.</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {CLASSMATES.map((c) => {
              const on = mates.some((m) => m.id === c.id);
              return (
                <li key={c.id}>
                  <button type="button" aria-pressed={on} disabled={!on && mates.length >= 3} onClick={() => setMates((m) => on ? m.filter((x) => x.id !== c.id) : [...m, c])} className={`h-full w-full rounded-2xl border-2 border-ink p-3.5 text-left disabled:opacity-50 ${on ? "bg-lagoon-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}>
                    <AnimatedAvatar name={c.name} color={c.color} gender={c.gender} speaking={false} />
                    <span className="mt-2 block font-display text-[1rem] font-bold text-ink">{c.name} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[0.62rem] font-bold ${c.gender === "female" ? "bg-coral-soft text-shapla-ink" : "bg-lagoon-soft text-padma-ink"}`}>{c.gender === "female" ? "Female" : "Male"}</span></span>
                    <span className="block text-[0.8rem] font-semibold text-brand-700">{c.personality}</span>
                    <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-muted">{c.habit}</span>
                    <span className="mt-2 block text-[0.75rem] font-bold">{on ? "Selected" : "Tap to select"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm font-semibold text-ink-soft" aria-live="polite">{mates.length} of 3 classmates selected{mates.length ? `: ${mates.map((m) => m.name).join(", ")}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => setStep("teacher")}>Back to teacher</button>
            <button type="button" className={BTN} disabled={starting || mates.length === 0} onClick={() => void startClass()}><Icon name="play" className="size-4" /> {starting ? "Starting class…" : "Start Class"}</button>
            <button type="button" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)} className={BTN_GHOST}><Icon name="chat" className="size-4" strokeWidth={1.9} /> Voice: {voiceOn ? "On" : "Off"}</button>
          </div>
        </section>
      ) : null}

      {step === "live" && lesson && teacher && chapter ? (
        <LiveClass
          teacher={teacher}
          mates={mates}
          activeSpeaker={activeSpeaker}
          subtitle={subtitle}
          boardSections={boardSections}
          activeTopicIdx={stepIdx}
          topicLabel={`Topic ${stepIdx + 1}/${lesson.explanations.length}: ${lesson.explanations[stepIdx]?.title}`}
          sourceLabel={sources[stepIdx % Math.max(1, sources.length)] ? `From your book · p. ${sources[stepIdx % sources.length].bookPage}` : null}
          speed={speed}
          onSpeedChange={setSpeed}
          paused={paused}
          onTogglePause={() => setPaused((v) => !v)}
          voiceOn={voiceOn}
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onExit={() => setStep("progress")}
          onDownloadNotes={downloadNotes}
          completedTopics={lesson.explanations.slice(0, stepIdx).map((e) => e.title)}
          currentTopic={lesson.explanations[stepIdx]?.title ?? chapter.title}
          remainingTopics={lesson.explanations.slice(stepIdx + 1).map((e) => e.title)}
          statsLine={`Class ${classLevel} · ${book?.title} · ${chapter.title} — ${correctCount}/${attempts} correct (${accuracy}%), ${reteachCount} re-explanations`}
          providerLine={degraded ? "Offline mode" : `Live with Meta AI (${provider})`}
          msgs={msgs}
          input={input}
          onInputChange={setInput}
          onSend={() => void send()}
          onSpeech={(audio, format) => void handleSpeech(audio, format)}
          busy={busy}
          answerPanel={phase === "checkpoint" && question ? (
            <div className="absolute inset-x-0 bottom-40 flex justify-center px-4 sm:bottom-36">
              <section className="w-full max-w-xl rounded-2xl border-2 border-ink bg-white p-4 shadow-hard-sm" aria-label="Answer your teacher">
                <h2 className="font-display text-[0.95rem] font-bold text-ink">{teacher.name} asks you:</h2>
                <p className="mt-1 text-sm font-semibold text-ink">{question.question}</p>
                {question.options.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {question.options.map((op) => (
                      <button key={op} type="button" className="rounded-full border-2 border-ink bg-paper px-3.5 py-1.5 text-[0.82rem] font-bold text-ink hover:bg-marigold-soft" onClick={() => { if (op === question.answer) void answerCorrect(); else answerWrong(op); }}>{op}</button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5 flex gap-1.5">
                    <input value={openAnswer} onChange={(e) => setOpenAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answerOpen()} placeholder="Type your answer…" className="h-10 min-w-0 flex-1 rounded-full border-2 border-ink bg-paper px-3 text-sm text-ink outline-none" />
                    <button type="button" className={BTN} disabled={!openAnswer.trim()} onClick={answerOpen}>Answer</button>
                  </div>
                )}
                <p className="mt-2 text-[0.78rem] text-ink-muted">Hint: {question.hint}</p>
              </section>
            </div>
          ) : null}
        />
      ) : null}

      {step === "progress" && chapter && teacher ? (
        <section className={`${CARD} p-5`} aria-label="Your learning progress">
          <span className="grid size-14 place-items-center rounded-full border-2 border-ink bg-flame text-night"><Icon name="check" className="size-7" strokeWidth={2.4} /></span>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink">Class complete — well done!</h2>
          <p className="mt-1 text-sm text-ink-soft">You finished {chapter.title} ({book?.title}, Class {classLevel}) with {teacher.name} and {mates.map((m) => m.name).join(", ") || "your classmates"}.</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <li className="rounded-xl bg-paper p-3.5"><span className="block font-display text-2xl font-bold text-ink">{lesson ? `${Math.min(stepIdx + 1, lesson.explanations.length)}/${lesson.explanations.length}` : "—"}</span><span className="text-[0.82rem] font-semibold text-ink-muted">Topics covered</span></li>
            <li className="rounded-xl bg-paper p-3.5"><span className="block font-display text-2xl font-bold text-ink">{correctCount}/{attempts}</span><span className="text-[0.82rem] font-semibold text-ink-muted">Checkpoint answers correct</span></li>
            <li className="rounded-xl bg-paper p-3.5"><span className="block font-display text-2xl font-bold text-ink">{accuracy}%</span><span className="text-[0.82rem] font-semibold text-ink-muted">Accuracy ({reteachCount} re-explanations)</span></li>
          </ul>
          {lesson ? <p className="mt-4 rounded-xl bg-sand px-3.5 py-2.5 text-sm font-medium text-ink"><strong>Teacher summary:</strong> {lesson.summary}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/progress" className={BTN}>View my learning progress <Icon name="arrow" className="size-4" strokeWidth={2.2} /></Link>
            {lesson && classLevel && !hwAssigned ? (
              <button type="button" className={BTN_GHOST} onClick={assignLessonHomework}>
                <Icon name="notes" className="size-4" strokeWidth={2} /> Set tonight&apos;s homework
              </button>
            ) : null}
            {hwAssigned ? (
              <Link href="/dashboard/homework" className={BTN_GHOST}>
                <Icon name="check" className="size-4" strokeWidth={2.2} /> Homework set — view it
              </Link>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={() => resetFlow("class")}>Start a new class</button>
            <button type="button" className={BTN_GHOST} onClick={() => resetFlow("chapter")}>Pick another chapter</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

