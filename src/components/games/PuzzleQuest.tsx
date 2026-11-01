"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../Icon";
import { pick, useLang } from "../../lib/i18n";
import type { GameChallenge, GameResult } from "../../lib/game-engine/types";
import type { ClientMission } from "../../lib/game-engine/server";

const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:opacity-60";
const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-full border-2 border-paper-edge bg-paper px-3 py-1.5 text-sm font-bold text-ink disabled:opacity-60";

interface AnswerOutcome {
  correct: boolean;
  recorded: boolean;
  attemptsLeft: number;
  explanation?: string;
  progress: { answered: number; total: number; currentChallengeId: string | null; status: string };
  result: GameResult | null;
}

type Stage = "landing" | "intro" | "playing" | "results";

const fractionText = (f: { numerator: number; denominator: number }) => `${f.numerator}/${f.denominator}`;

export function PuzzleQuest() {
  const { lang } = useLang();
  const [missions, setMissions] = useState<ClientMission[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<Stage>("landing");
  const [mission, setMission] = useState<ClientMission | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "good" | "try" | "done"; text: string } | null>(null);
  const [hint, setHint] = useState<{ text: string; level: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadFailed(false);
      const res = await fetch("/api/games/missions");
      const data = (await res.json()) as { missions: ClientMission[] };
      setMissions(data.missions);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(id);
  }, [load]);

  const challenge: GameChallenge | null = mission?.challenges.find((c) => c.id === currentId) ?? null;
  const total = mission?.challenges.length ?? 0;

  function resetAnswerInputs() {
    setAnswer("");
    setSelected(null);
    setPlaced([]);
    setFeedback(null);
    setHint(null);
  }

  async function startMission(selectedMission: ClientMission) {
    setBusy(true);
    try {
      const res = await fetch("/api/games/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ missionId: selectedMission.id }),
      });
      const data = (await res.json()) as { sessionId: string; mission: ClientMission };
      setMission(data.mission);
      setSessionId(data.sessionId);
      setCurrentId(data.mission.challenges[0]?.id ?? null);
      setAnswered(0);
      setResult(null);
      setPaused(false);
      resetAnswerInputs();
      setStage("playing");
    } catch {
      setLoadFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function currentAnswer(): unknown {
    if (!challenge) return null;
    if (challenge.mechanicId === "drag-build") return placed;
    if (challenge.mechanicId === "fraction-puzzle" && (challenge.payload as { mode?: string }).mode === "compare") return selected;
    if (challenge.mechanicId === "logic-puzzle") return selected;
    if (challenge.mechanicId === "shape-puzzle" && (challenge.payload as { ask?: string }).ask === "name") return selected;
    return answer.trim() === "" ? "" : Number.isNaN(Number(answer)) && challenge.mechanicId !== "fraction-puzzle" ? answer : challenge.mechanicId === "fraction-puzzle" ? answer.trim() : Number(answer);
  }

  async function submit() {
    if (!sessionId || !challenge || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, answer: currentAnswer() }),
      });
      const outcome = (await res.json()) as AnswerOutcome & { error?: string; detail?: string };
      if (!res.ok) throw new Error(outcome.detail ?? outcome.error ?? "failed");
      setAnswered(outcome.progress.answered);
      if (!outcome.recorded) {
        setFeedback({ kind: "try", text: pick(lang, "Good try — that is how we learn. Read the clue and have another go.", "ভালো চেষ্টা — এভাবেই শেখা হয়। সূত্রটা পড়ে আবার চেষ্টা করো।") });
        return;
      }
      if (outcome.result) {
        setResult(outcome.result);
        setStage("results");
        return;
      }
      setFeedback({ kind: outcome.correct ? "good" : "done", text: outcome.explanation ?? "" });
      setCurrentId(outcome.progress.currentChallengeId);
      setAnswer("");
      setSelected(null);
      setPlaced([]);
      setHint(null);
    } catch {
      setFeedback({ kind: "try", text: pick(lang, "That answer could not be checked. Try again.", "উত্তরটি যাচাই করা যায়নি। আবার চেষ্টা করো।") });
    } finally {
      setBusy(false);
    }
  }

  async function askHint() {
    if (!sessionId || !challenge) return;
    try {
      const res = await fetch(`/api/games/sessions/${sessionId}/hint`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id }),
      });
      const data = (await res.json()) as { hint: string | null; level: number; total: number };
      if (data.hint) setHint({ text: data.hint, level: data.level, total: data.total });
    } catch { /* hints are optional help; the game continues without one */ }
  }

  async function togglePause() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/games/sessions/${sessionId}/${paused ? "resume" : "pause"}`, { method: "POST" });
      const data = (await res.json()) as { status: string };
      setPaused(data.status === "paused");
    } catch { /* keep current state */ }
  }

  if (loadFailed && !missions) {
    return (
      <div className={`${CARD} p-6 text-center`} role="alert">
        <h2 className="text-lg text-ink">{pick(lang, "Puzzle Quest could not load", "পাজল কোয়েস্ট লোড করা যায়নি")}</h2>
        <button type="button" className={`${BTN} mt-4`} onClick={() => void load()}>{pick(lang, "Try again", "আবার চেষ্টা করো")}</button>
      </div>
    );
  }
  if (!missions) {
    return <div className={`${CARD} h-40 animate-pulse p-5`} role="status" aria-label={pick(lang, "Loading Puzzle Quest", "পাজল কোয়েস্ট লোড হচ্ছে")} />;
  }

  if (stage === "results" && result) {
    return (
      <div className={`${CARD} p-5`} role="status">
        <h2 className="text-xl text-ink">{pick(lang, "Quest complete!", "অভিযান শেষ!")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [pick(lang, "Challenges", "চ্যালেঞ্জ"), String(result.totalChallenges)],
            [pick(lang, "Correct", "সঠিক"), String(result.correct)],
            [pick(lang, "Hints used", "ব্যবহৃত সূত্র"), String(result.hintsUsed)],
            [pick(lang, "Score", "স্কোর"), String(result.score)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-paper px-3 py-2">
              <dt className="text-[0.75rem] font-semibold text-ink-muted">{label}</dt>
              <dd className="font-display text-xl font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-soft">{pick(lang, "Well done for finishing every challenge. Try the quest again any time to practise more.", "প্রতিটি চ্যালেঞ্জ শেষ করার জন্য শাবাশ। আরও অনুশীলনের জন্য যেকোনো সময় আবার খেলো।")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => mission && void startMission(mission)}>{pick(lang, "Play again", "আবার খেলো")}</button>
          <button type="button" className={BTN_GHOST} onClick={() => setStage("landing")}>{pick(lang, "Back to missions", "মিশনে ফিরে যাও")}</button>
        </div>
      </div>
    );
  }

  if (stage === "intro" && mission) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="text-xs font-bold text-ink-muted">{pick(lang, `Class ${mission.grade} · Mathematics · about ${mission.estimatedMinutes} minutes`, `শ্রেণি ${mission.grade} · গণিত · প্রায় ${mission.estimatedMinutes} মিনিট`)}</p>
        <h2 className="mt-1 text-xl text-ink">{mission.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{mission.description}</p>
        <h3 className="mt-4 text-sm font-bold text-ink">{pick(lang, "You will practise:", "তুমি অনুশীলন করবে:")}</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
          {mission.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}
        </ul>
        {mission.contentStatus === "draft-sample" ? (
          <p className="mt-3 rounded-xl bg-marigold-soft px-3 py-2 text-xs font-semibold text-ink">{pick(lang, "Sample mission: practice questions written for this demo, not NCTB-approved content.", "নমুনা মিশন: এই ডেমোর জন্য লেখা অনুশীলন প্রশ্ন, NCTB-অনুমোদিত কনটেন্ট নয়।")}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BTN} disabled={busy} onClick={() => void startMission(mission)}>
            <Icon name="play" className="size-4" />{pick(lang, "Start quest", "অভিযান শুরু করো")}
          </button>
          <button type="button" className={BTN_GHOST} onClick={() => setStage("landing")}>{pick(lang, "Back", "ফিরে যাও")}</button>
        </div>
      </div>
    );
  }

  if (stage === "playing" && mission && challenge) {
    const payload = challenge.payload as Record<string, unknown>;
    const stageLabel = challenge.stage === "warmup" ? pick(lang, "Warm-up", "ওয়ার্ম-আপ") : challenge.stage === "final" ? pick(lang, "Final challenge", "শেষ চ্যালেঞ্জ") : pick(lang, "Challenge", "চ্যালেঞ্জ");
    return (
      <div className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg text-ink">{stageLabel} · {answered}/{total}</h2>
          <button type="button" className={BTN_GHOST} onClick={() => void togglePause()}>{paused ? pick(lang, "Resume", "আবার শুরু") : pick(lang, "Pause", "বিরতি")}</button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-edge" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full bg-flame transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
        </div>
        {paused ? (
          <p className="mt-6 text-center text-sm font-semibold text-ink-soft">{pick(lang, "Paused. Take a breath — your quest is waiting.", "বিরতি। একটু বিশ্রাম নাও — তোমার অভিযান অপেক্ষা করছে।")}</p>
        ) : (
          <>
            <p className="mt-4 text-[1.05rem] font-semibold text-ink">{challenge.prompt}</p>
            <ChallengeInput challenge={challenge} payload={payload} answer={answer} setAnswer={setAnswer} selected={selected} setSelected={setSelected} placed={placed} setPlaced={setPlaced} lang={lang} />
            {hint ? (
              <p className="mt-3 rounded-xl bg-lagoon-soft px-3 py-2 text-sm text-ink" role="status">
                <strong>{pick(lang, `Hint ${hint.level}/${hint.total}: `, `সূত্র ${hint.level}/${hint.total}: `)}</strong>{hint.text}
              </p>
            ) : null}
            {feedback ? (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${feedback.kind === "try" ? "bg-marigold-soft text-ink" : "bg-jolpai-soft text-ink"}`} role={feedback.kind === "try" ? "alert" : "status"}>
                {feedback.text}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={BTN} disabled={busy} onClick={() => void submit()}>
                <Icon name="check" className="size-4" />{pick(lang, "Check answer", "উত্তর যাচাই করো")}
              </button>
              <button type="button" className={BTN_GHOST} onClick={() => void askHint()}>
                <Icon name="lightbulb" className="size-4" />{pick(lang, "Hint", "সূত্র")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`${CARD} p-5`}>
        <h2 className="font-display text-xl font-bold text-ink">Puzzle Quest</h2>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, "Solve curriculum puzzles, one mission at a time. No timers, no pressure — just thinking.", "একটি করে মিশনে পাঠ্যক্রমের ধাঁধা সমাধান করো। কোনো টাইমার নেই, চাপ নেই — শুধু ভাবনা।")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {missions.map((m) => (
          <li key={m.id} className={`${CARD} flex flex-col gap-2 p-4`}>
            <span className="text-xs font-bold text-ink-muted">{pick(lang, `Class ${m.grade} · Mathematics`, `শ্রেণি ${m.grade} · গণিত`)}</span>
            <h3 className="font-display text-lg leading-snug font-bold text-ink">{m.title}</h3>
            <p className="text-sm text-ink-soft">{m.description}</p>
            {m.contentStatus === "draft-sample" ? <span className="self-start rounded-full bg-marigold-soft px-2 py-0.5 text-[0.7rem] font-bold text-ink">{pick(lang, "Sample mission", "নমুনা মিশন")}</span> : null}
            <button type="button" className={`${BTN} mt-auto self-start`} onClick={() => { setMission(m); setStage("intro"); }}>
              <Icon name="play" className="size-4" />{pick(lang, "View mission", "মিশন দেখো")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChallengeInput({ challenge, payload, answer, setAnswer, selected, setSelected, placed, setPlaced, lang }: {
  challenge: GameChallenge;
  payload: Record<string, unknown>;
  answer: string;
  setAnswer: (v: string) => void;
  selected: string | null;
  setSelected: (v: string) => void;
  placed: string[];
  setPlaced: (v: string[]) => void;
  lang: "en" | "bn";
}) {
  const inputCls = "mt-3 w-full max-w-xs rounded-xl border-2 border-paper-edge bg-paper px-3 py-2 text-lg font-bold text-ink focus:border-ink focus:outline-none";

  if (challenge.mechanicId === "number-sequence") {
    const sequence = (payload.sequence as (number | null)[]) ?? [];
    return (
      <div>
        <p className="mt-3 flex flex-wrap gap-2" aria-label="sequence">
          {sequence.map((v, i) => (
            <span key={i} className="grid size-11 place-items-center rounded-xl border-2 border-ink bg-paper font-display text-lg font-bold text-ink">{v === null ? "?" : v}</span>
          ))}
        </p>
        <input className={inputCls} inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={pick(lang, "Missing number", "হারানো সংখ্যা")} placeholder="?" />
      </div>
    );
  }

  if (challenge.mechanicId === "equation-puzzle" || challenge.mechanicId === "shape-puzzle" && payload.ask !== "name") {
    return <input className={inputCls} inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={pick(lang, "Your answer", "তোমার উত্তর")} />;
  }

  if (challenge.mechanicId === "fraction-puzzle") {
    if (payload.mode === "compare") {
      const left = payload.left as { numerator: number; denominator: number };
      const rightF = payload.right as { numerator: number; denominator: number };
      const options: [string, string][] = [["left", fractionText(left)], ["equal", "="], ["right", fractionText(rightF)]];
      return (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={pick(lang, "Choose the bigger fraction", "বড় ভগ্নাংশটি বেছে নাও")}>
          {options.map(([value, labelText]) => (
            <button key={value} type="button" role="radio" aria-checked={selected === value} onClick={() => setSelected(value)} className={`rounded-xl border-2 px-4 py-2 font-display text-lg font-bold ${selected === value ? "border-ink bg-flame text-night" : "border-paper-edge bg-paper text-ink"}`}>{labelText}</button>
          ))}
        </div>
      );
    }
    return <input className={inputCls} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={pick(lang, "Your fraction, like 2/4", "তোমার ভগ্নাংশ, যেমন 2/4")} placeholder="2/4" />;
  }

  if (challenge.mechanicId === "logic-puzzle" || (challenge.mechanicId === "shape-puzzle" && payload.ask === "name")) {
    const options = (payload.options as string[]) ?? [];
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={pick(lang, "Choose one answer", "একটি উত্তর বেছে নাও")}>
        {options.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={selected === option} onClick={() => setSelected(option)} className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold ${selected === option ? "border-ink bg-flame text-night" : "border-paper-edge bg-paper text-ink"}`}>{option}</button>
        ))}
      </div>
    );
  }

  if (challenge.mechanicId === "drag-build") {
    const tiles = (payload.tiles as string[]) ?? [];
    const remaining = tiles.filter((tile, idx) => tiles.indexOf(tile) !== idx || !placed.includes(tile) || placed.filter((p) => p === tile).length < tiles.filter((t) => t === tile).slice(0, tiles.indexOf(tile) + 1).length);
    void remaining;
    const available = tiles.filter((tile) => !placed.includes(tile) || placed.filter((p) => p === tile).length < tiles.filter((t) => t === tile).length);
    return (
      <div>
        <p className="mt-2 text-sm text-ink-soft">{String(payload.instruction ?? "")}</p>
        <div className="mt-3 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-paper-edge bg-paper px-2 py-2" aria-label={pick(lang, "Your build", "তোমার তৈরি")}>
          {placed.length === 0 ? <span className="text-sm text-ink-muted">{pick(lang, "Tap tiles below to build…", "তৈরি করতে নিচের টাইল চাপ দাও…")}</span> : placed.map((tile, i) => (
            <span key={`${tile}-${i}`} className="inline-flex items-center gap-1 rounded-lg border-2 border-ink bg-white px-2 py-1 font-display text-lg font-bold text-ink">
              {tile}
              <button type="button" aria-label={pick(lang, `Move ${tile} left`, `${tile} বামে সরাও`)} className="px-1 text-sm" onClick={() => { if (i > 0) { const next = [...placed]; [next[i - 1], next[i]] = [next[i]!, next[i - 1]!]; setPlaced(next); } }}>←</button>
              <button type="button" aria-label={pick(lang, `Move ${tile} right`, `${tile} ডানে সরাও`)} className="px-1 text-sm" onClick={() => { if (i < placed.length - 1) { const next = [...placed]; [next[i + 1], next[i]] = [next[i]!, next[i + 1]!]; setPlaced(next); } }}>→</button>
              <button type="button" aria-label={pick(lang, `Remove ${tile}`, `${tile} সরিয়ে দাও`)} className="px-1 text-sm" onClick={() => setPlaced(placed.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" aria-label={pick(lang, "Tiles", "টাইল")}>
          {available.map((tile, i) => (
            <button key={`${tile}-${i}`} type="button" className="rounded-lg border-2 border-ink bg-flame px-3 py-1.5 font-display text-lg font-bold text-night" onClick={() => setPlaced([...placed, tile])}>{tile}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{pick(lang, "Keyboard: Tab to a placed tile, then use the ← → buttons to reorder.", "কীবোর্ড: Tab দিয়ে রাখা টাইলে যাও, তারপর ← → বোতামে সাজাও।")}</p>
      </div>
    );
  }

  return <input className={inputCls} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={pick(lang, "Your answer", "তোমার উত্তর")} />;
}
