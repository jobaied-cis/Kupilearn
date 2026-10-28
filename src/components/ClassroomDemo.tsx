"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const BN = "০১২৩৪৫৬৭৮৯";
const bn = (value: unknown) => String(value).replace(/[0-9]/g, (d) => BN[+d]);

const COPY = {
  chapter: "অধ্যায় ৮ — সরল সমীকরণ",
  live: "লাইভ ক্লাস",
  heading: "সংখ্যাটি খুঁজি",
  problem: ["একটি সংখ্যার ৩ গুণ থেকে ৭ বিয়োগ", "করলে ২০ হয়। সংখ্যাটি কত?"],
  marks: { highlight: "৩ গুণ", underline: "৭ বিয়োগ" },
  steps: ["৩x − ৭ = ২০", "৩x = ২০ + ৭ = ২৭", "x = ২৭ ÷ ৩ = ৯"],
  sideNote: "দুই পাশে + ৭",
  note: { title: "মনে রাখো", text: "সমীকরণ দাঁড়িপাল্লার মতো — এক পাশে যা করবে, অন্য পাশেও তাই।" },
  check: "যাচাই: ৩ × ৯ − ৭ = ২০",
  question: "x-কে একা করতে প্রথমে কী করবে?",
  answers: { first: "৭ বিয়োগ করব", second: "দুই পাশে ৭ যোগ করব" },
  hint: "আরেকবার ভাবো — ‘− ৭’ সরাতে উল্টো কাজটা কী?",
  right: "একদম ঠিক!",
  studentAsks: "উত্তরটা ঠিক কিনা কীভাবে বুঝব?",
  noteSaved: "নোটে সেভ হলো",
  you: "তুমি",
  answerLabel: "তোমার উত্তর",
  teacher: "নাসরিন ম্যাম",
  pause: "ক্লাসের অ্যানিমেশন থামান",
  play: "ক্লাসের অ্যানিমেশন চালান",
  lines: {
    hello: "চলো, আজ একটা সংখ্যার ধাঁধা সমাধান করি!",
    read: "প্রথমে প্রশ্নটা মন দিয়ে পড়ি।",
    mark: "দেখো — ‘৩ গুণ’ আর ‘৭ বিয়োগ’, এই দুটোই আসল সূত্র।",
    unknown: "অজানা সংখ্যাকে x ধরলে সমীকরণটা দাঁড়ায় এমন।",
    ask: "এবার তুমি বলো তো — x-কে একা করতে প্রথমে কী করবে?",
    hint: "প্রায় হয়েছে! ‘− ৭’ সরাতে উল্টো কাজটা ভাবো।",
    praise: "দারুণ! দুই পাশে ৭ যোগ করলেই ‘− ৭’ চলে যায়।",
    divide: "এবার দুই পাশকে ৩ দিয়ে ভাগ করি… x = ৯!",
    note: "এটা নোটে লিখে রাখো, পরীক্ষায় কাজে লাগবে।",
    check: "ভালো প্রশ্ন! x-এর জায়গায় ৯ বসিয়ে মিলিয়ে দেখি।",
    done: "মিলে গেছে! পুরো বোর্ডটা একবার দেখে নাও।",
  },
  tools: {
    pen: "কলমে লিখছেন",
    mark: "দাগিয়ে দিচ্ছেন",
    ask: "তোমাকে প্রশ্ন",
    answer: "তুমি উত্তর দিচ্ছ",
    hint: "হিন্ট দিচ্ছেন",
    note: "নোট নেওয়া হচ্ছে",
    hand: "তুমি প্রশ্ন করলে",
    review: "পুরো বোর্ড",
  } as Record<string, string>,
};

const LOOP = 35000;
const STILL = 33000;
const ASKS = 26400;
const SAVED = 25200;
const W: Record<string, [number, number]> = {
  heading: [300, 900], problem0: [1500, 1500], problem1: [3100, 1200], highlight: [4900, 700],
  underline: [5700, 700], step0: [7300, 1300], step1: [17300, 1500], sideNote: [18900, 800],
  step2: [20100, 1300], circle: [21600, 800], note: [23000, 1600], check: [28200, 1300], tick: [29600, 500],
};
const Q = { open: 9300, type1: [10300, 1100] as [number, number], send1: 11700, type2: [14000, 1400] as [number, number], clear: 13800, send2: 15700, close: 17600 };
const L = COPY.lines;
const LINES: { at: number; who: "teacher" | "student"; text: string }[] = [
  { at: 0, who: "teacher", text: L.hello }, { at: 1400, who: "teacher", text: L.read },
  { at: 4500, who: "teacher", text: L.mark }, { at: 6900, who: "teacher", text: L.unknown },
  { at: 9000, who: "teacher", text: L.ask }, { at: 12000, who: "teacher", text: L.hint },
  { at: 16000, who: "teacher", text: L.praise }, { at: 19900, who: "teacher", text: L.divide },
  { at: 22700, who: "teacher", text: L.note }, { at: ASKS, who: "student", text: COPY.studentAsks },
  { at: 27800, who: "teacher", text: L.check }, { at: 30500, who: "teacher", text: L.done },
];
const TOOL_ICON: Record<string, IconName> = {
  pen: "pencil", mark: "crosshair", ask: "chat", answer: "keyboard",
  hint: "lightbulb", note: "notes", hand: "hand", review: "expand",
};
const TOOLS: [number, string][] = [
  [0, "pen"], [4500, "mark"], [6900, "pen"], [9000, "ask"], [10300, "answer"], [12000, "hint"], [13800, "answer"],
  [16000, "ask"], [17300, "pen"], [21500, "mark"], [22700, "note"], [ASKS, "hand"], [28100, "pen"], [30500, "review"],
];
const WORLD_W = 520;
const ROW = { heading: 22, problem0: 78, problem1: 110, step0: 162, step1: 216, step2: 270, note: 330, check: 440 };

function cameraFrames(viewH: number): [number, number, number, number][] {
  return [
    [0, 260, viewH / 2, 1], [4300, 260, viewH / 2, 1], [5000, 190, 96, 1.45], [6600, 190, 96, 1.45],
    [7200, 260, 190, 1], [8800, 260, 190, 1], [9400, 260, 110 + viewH / 2, 1], [16800, 260, 110 + viewH / 2, 1],
    [17400, 260, 225, 1], [21300, 260, 225, 1], [21800, 220, 282, 1.35], [22600, 220, 282, 1.35],
    [23100, 260, 340, 1], [27900, 260, 340, 1], [28300, 260, 370, 1], [30600, 260, 370, 1], [31900, 260, 248, viewH / 520],
  ];
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const span = (t: number, w: [number, number]) => clamp01((t - w[0]) / w[1]);
function cameraAt(t: number, frames: [number, number, number, number][]) {
  let i = 0;
  while (i < frames.length - 1 && frames[i + 1][0] <= t) i++;
  const a = frames[i];
  const b = frames[i + 1];
  if (!b) return { x: a[1], y: a[2], s: a[3] };
  const k = ease(clamp01((t - a[0]) / (b[0] - a[0])));
  return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, s: a[3] + (b[3] - a[3]) * k };
}
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("bn", { granularity: "grapheme" })
    : null;
function graphemes(text: string) {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}
function mathLine(text: string): ReactNode {
  return text.split(/(x)/).map((part, i) =>
    part === "x" ? (
      <i key={i} className="font-serif">x</i>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const UNDERLINE = "M1 70 C 20 45, 38 85, 55 60 S 88 45, 99 62";
const CIRCLE = "M58 4 C 86 4, 99 26, 98 50 C 97 78, 74 97, 48 96 C 20 95, 2 76, 3 49 C 4 24, 26 6, 52 5 C 60 5, 68 7, 74 10";
const TICK = "M4 55 L 36 88 L 96 8";

function Pen({ p, tone }: { p: number; tone: "ink" | "marker" }) {
  if (!(p > 0 && p < 1)) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-0" style={{ left: `${p * 100}%` }}>
      <Icon
        name="pencil"
        strokeWidth={2}
        className={`size-7 -translate-x-0.5 -translate-y-5 ${
          tone === "ink" ? "text-ink drop-shadow-[2px_2px_0_var(--color-marigold)]" : "text-ember drop-shadow-[2px_2px_0_var(--color-ink)]"
        }`}
      />
    </span>
  );
}

function Ink({
  p,
  className,
  style,
  inline,
  children,
}: {
  p: number;
  className?: string;
  style?: CSSProperties;
  inline?: boolean;
  children: ReactNode;
}) {
  const right = p >= 1 ? -12 : (1 - p) * 100;
  return (
    <div
      className={`${inline ? "relative" : "absolute"} ${className ?? ""} ${p <= 0 ? "invisible" : ""}`}
      style={style}
    >
      <div className="relative inline-block whitespace-nowrap">
        <div style={{ clipPath: `inset(-150% ${right}% -80% -4%)` }}>{children}</div>
        <Pen p={p} tone="ink" />
      </div>
    </div>
  );
}

function TeacherAvatar({ talking }: { talking: boolean }) {
  return (
    <svg
      viewBox="0 0 240 250"
      className="absolute top-[-16%] left-[-35%] block w-[170%] max-w-none"
      style={talking ? { animation: "board-bob 1.6s ease-in-out infinite" } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="120" cy="150" r="98" fill="var(--color-coral-soft)" />
      <path d="M120 47 C164 47 176 80 174 116 C173 136 170 150 163 156 L77 156 C70 150 67 136 66 116 C64 80 76 47 120 47 Z" fill="var(--color-ink)" />
      <path d="M105 134 L105 172 Q120 180 135 172 L135 134 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M26 264 C30 224 46 204 82 192 C94 188 102 180 105 166 L135 166 C138 180 146 188 158 192 C194 204 210 224 214 264 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
      <g fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M105 166 Q87 176 92 192 Q112 194 120 180" />
        <path d="M135 166 Q153 176 148 192 Q128 194 120 180" />
      </g>
      <path d="M97 172 L113 224 M143 172 L127 224" stroke="var(--color-coral)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="106" y="222" width="28" height="34" rx="4" fill="#fff" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="107.5" y="223.5" width="25" height="8" rx="2" fill="var(--color-coral)" />
      <circle cx="120" cy="240" r="4" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
      <path d="M113 250 L127 250" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M84 94 C72 90 70 114 86 117" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M156 94 C168 90 170 114 154 117" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M120 55 C148 55 158 78 158 100 C158 126 142 146 120 146 C98 146 82 126 82 100 C82 78 92 55 120 55 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M98 90 Q106 86 114 89 M126 89 Q134 86 142 90" stroke="var(--color-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g className="avatar-eyes" fill="var(--color-ink)">
        <ellipse cx="106" cy="103" rx="3.2" ry="4" />
        <ellipse cx="134" cy="103" rx="3.2" ry="4" />
      </g>
      <path d="M121 106 Q115 116 122 118" stroke="var(--color-ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M110 128 Q120 135 130 128" stroke="var(--color-ink)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse className="avatar-mouth" cx="120" cy="131" rx="7.5" ry="6.5" fill="var(--color-ink)" />
      <g stroke="var(--color-ink)" strokeWidth="2.8" fill="rgb(255 255 255 / 0.18)" strokeLinecap="round">
        <rect x="93" y="94" width="24" height="18" rx="6" />
        <rect x="123" y="94" width="24" height="18" rx="6" />
        <path d="M117 102 Q120 99 123 102 M93 101 L84 99 M147 101 L156 99" fill="none" />
      </g>
      <path d="M81 108 C78 76 94 54 120 54 C146 54 162 76 159 108 C156 92 150 80 140 72 C130 82 112 84 98 78 C90 86 84 96 81 108 Z" fill="var(--color-ink)" />
    </svg>
  );
}

function StudentAvatar() {
  return (
    <svg viewBox="0 0 240 250" className="absolute top-[-16%] left-[-35%] block w-[170%] max-w-none" aria-hidden="true" focusable="false">
      <circle cx="120" cy="150" r="98" fill="var(--color-marigold-soft)" />
      <path d="M108 146 L108 188 Q120 194 132 188 L132 146 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M44 264 C48 230 62 214 92 204 C102 200 107 193 109 182 L131 182 C133 193 138 200 148 204 C178 214 192 230 196 264 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
      <g fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M109 182 L97 202 L112 214 L120 199 Z" />
        <path d="M131 182 L143 202 L128 214 L120 199 Z" />
      </g>
      <path d="M115 203 L125 203 L123 210 L128 242 L120 252 L112 242 L117 210 Z" fill="var(--color-marigold)" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 216 L88 216 L88 229 Q79 240 70 229 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M79 221 L81 226 L76.5 223 L81.5 223 L77 226 Z" fill="var(--color-marigold)" />
      <g transform="translate(120 106) scale(1.07) translate(-120 -100)">
        <path d="M84 94 C72 90 70 114 86 117" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <path d="M156 94 C168 90 170 114 154 117" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 55 C148 55 158 78 158 100 C158 126 142 146 120 146 C98 146 82 126 82 100 C82 78 92 55 120 55 Z" fill="#fff" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M98 90 Q106 86 114 89 M126 89 Q134 86 142 90" stroke="var(--color-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="106" cy="104" rx="4.4" ry="5.4" fill="var(--color-ink)" />
        <ellipse cx="134" cy="104" rx="4.4" ry="5.4" fill="var(--color-ink)" />
        <circle cx="107.6" cy="102" r="1.5" fill="#fff" />
        <circle cx="135.6" cy="102" r="1.5" fill="#fff" />
        <ellipse cx="97" cy="120" rx="6" ry="3.4" fill="var(--color-coral)" opacity="0.28" />
        <ellipse cx="143" cy="120" rx="6" ry="3.4" fill="var(--color-coral)" opacity="0.28" />
        <path d="M121 106 Q115 116 122 118" stroke="var(--color-ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M109 126 Q120 138 131 126 Q120 130 109 126 Z" fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M83 98 C80 70 96 54 120 54 C144 54 160 70 157 98 C152 84 142 76 120 76 C98 76 88 84 83 98 Z" fill="var(--color-ink)" />
      </g>
    </svg>
  );
}

export function ClassroomDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const [fit, setFit] = useState<{ scale: number; viewH: number } | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const scale = viewport.clientWidth / WORLD_W;
      if (scale > 0) setFit({ scale, viewH: Math.round(viewport.clientHeight / scale) });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(viewport);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setInView(entries[0].isIntersecting), { threshold: 0.15 });
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !playing || !inView) return;
    let raf = 0;
    let last = performance.now();
    const tick = (nowMs: number) => {
      const dt = Math.min(nowMs - last, 100);
      last = nowMs;
      tRef.current = (tRef.current + dt) % LOOP;
      setT(tRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, playing, inView]);

  const now = still ? STILL : t;
  const viewH = fit?.viewH ?? 300;
  const frames = cameraFrames(viewH);
  const cam = cameraAt(now, frames);
  const p = (key: string) => span(now, W[key]);

  let line = LINES[0];
  for (let i = LINES.length - 1; i >= 0; i--) if (LINES[i].at <= now) { line = LINES[i]; break; }
  const lineEnd = line.at + Math.min(3200, Math.max(1500, line.text.length * 55));
  const teacherTalking = !still && playing && line.who === "teacher" && now < lineEnd;
  let tool = TOOLS[0][1];
  for (let j = TOOLS.length - 1; j >= 0; j--) if (TOOLS[j][0] <= now) { tool = TOOLS[j][1]; break; }

  const cardOpen = now >= Q.open && now < Q.close;
  const firstTry = now < Q.clear;
  const typedParts = graphemes(firstTry ? COPY.answers.first : COPY.answers.second);
  const typedP = firstTry ? span(now, Q.type1) : span(now, Q.type2);
  const typedText = typedParts.slice(0, Math.round(typedP * typedParts.length)).join("");
  const sending = (now >= Q.send1 && now < Q.send1 + 250) || (now >= Q.send2 && now < Q.send2 + 250);
  const feedback = now >= Q.send2 + 300 ? "right" : now >= Q.send1 + 300 && firstTry ? "hint" : null;
  const caretOn = Math.floor(now / 450) % 2 === 0;
  const notes = now >= SAVED + 400;
  const toast = now >= SAVED && now < SAVED + 1600;
  const handUp = now >= ASKS && now < 29400;
  const fade = still ? 1 : Math.min(clamp01(now / 400), clamp01((LOOP - now) / 700));
  const secs = 12 * 60 + 40 + Math.floor(now / 1000);
  const clock = `${bn(String(Math.floor(secs / 60)).padStart(2, "0"))}:${bn(String(secs % 60).padStart(2, "0"))}`;
  const mouth = teacherTalking ? Math.max(0, 0.55 * Math.sin(now / 95) * Math.sin(now / 37 + 1) + 0.25) : 0;

  const stepRows: { key: string; top: number }[] = [
    { key: "step0", top: ROW.step0 },
    { key: "step1", top: ROW.step1 },
    { key: "step2", top: ROW.step2 },
  ];

  return (
    <div ref={rootRef} className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink bg-white text-ink shadow-hard-lg">
      <div className="sr-only">
        <p>{COPY.chapter}. {COPY.problem.join(" ")}</p>
        <ol>
          {LINES.map((l) => (
            <li key={l.at}>{l.who === "teacher" ? COPY.teacher : COPY.you}: {l.text}</li>
          ))}
        </ol>
      </div>

      <div className="relative flex items-center justify-between gap-2 border-b-2 border-ink bg-paper px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-marigold text-ink">
            <Icon name="board" className="size-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.78rem] font-semibold">{COPY.chapter}</p>
            <p className="flex items-center gap-1.5 text-[0.68rem] text-ink-muted">
              <span aria-hidden="true" className={`size-1.5 rounded-full bg-coral ${!still && playing ? "animate-blink" : ""}`} />
              {COPY.live} • <span className="numerals-bn font-mono">{clock}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
          {(["pen", "mark", "note"] as const).map((name) => (
            <span
              key={name}
              className={`relative grid size-7 place-items-center rounded-full border transition-colors duration-300 ${
                tool === name ? "border-ink bg-marigold text-ink" : "border-transparent text-ink-muted"
              } ${name !== "note" ? "hidden sm:grid" : ""}`}
            >
              <Icon name={TOOL_ICON[name]} className="size-3.5" strokeWidth={2.2} />
              {name === "note" && notes ? (
                <span className="numerals-bn absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-coral text-[0.55rem] font-bold text-white">১</span>
              ) : null}
            </span>
          ))}
        </div>
        {!still && (
          <button
            type="button"
            aria-pressed={!playing}
            onClick={() => setPlaying((v) => !v)}
            className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink shadow-hard-sm transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
          >
            <Icon name={playing ? "pause" : "play"} className="size-3.5" strokeWidth={2.2} />
            <span className="sr-only">{playing ? COPY.pause : COPY.play}</span>
          </button>
        )}
      </div>

      <div ref={viewportRef} aria-hidden="true" className="relative aspect-[520/400] overflow-hidden bg-paper sm:aspect-[520/300]">
        <div
          className="absolute inset-0"
          style={{
            display: fit ? undefined : "none",
            backgroundImage:
              "linear-gradient(to right, rgb(36 89 199 / 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgb(36 89 199 / 0.09) 1px, transparent 1px)",
            backgroundSize: fit ? `${26 * cam.s * fit.scale}px ${26 * cam.s * fit.scale}px` : undefined,
            backgroundPosition: fit
              ? `${(WORLD_W / 2 - cam.x * cam.s) * fit.scale}px ${(viewH / 2 - cam.y * cam.s) * fit.scale}px`
              : undefined,
          }}
        />
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: WORLD_W,
            height: viewH,
            transform: `scale(${fit?.scale ?? 0})`,
            visibility: fit ? "visible" : "hidden",
            opacity: fade,
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: WORLD_W, transform: `translate(${WORLD_W / 2 - cam.x * cam.s}px, ${viewH / 2 - cam.y * cam.s}px) scale(${cam.s})` }}
          >
            <Ink p={p("heading")} className="font-display text-[28px] font-bold text-ink" style={{ top: ROW.heading, left: 32 }}>
              {COPY.heading}
            </Ink>
            <Ink p={p("problem0")} className="text-[19px] text-ink-soft" style={{ top: ROW.problem0, left: 32 }}>
              একটি সংখ্যার{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[-2px] top-[38%] bottom-[6%] rounded-[0.2em] bg-marigold/55"
                  style={{ clipPath: `inset(0 ${(1 - p("highlight")) * 100}% 0 0)` }}
                />
                <span className="relative">{COPY.marks.highlight}</span>
                <Pen p={p("highlight")} tone="marker" />
              </span>{" "}
              থেকে{" "}
              <span className="relative inline-block">
                {COPY.marks.underline}
                <svg className="pointer-events-none absolute -bottom-[0.3em] left-0 h-[0.45em] w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path d={UNDERLINE} pathLength="1" fill="none" stroke="var(--color-coral)" strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1" strokeDashoffset={1 - p("underline")} />
                </svg>
                <Pen p={p("underline")} tone="marker" />
              </span>
            </Ink>
            <Ink p={p("problem1")} className="text-[19px] text-ink-soft" style={{ top: ROW.problem1, left: 32 }}>
              {COPY.problem[1]}
            </Ink>

            {stepRows.map((row, i) => (
              <div key={row.key} className="absolute flex items-center gap-3" style={{ top: row.top, left: 32 }}>
                <span
                  className={`numerals-bn grid size-7 shrink-0 place-items-center rounded-lg border-2 text-[13px] font-bold transition-opacity duration-300 ${
                    i === 2 ? "border-ink bg-marigold" : "border-ink/70 bg-white"
                  } ${p(row.key) > 0 ? "opacity-100" : "opacity-0"}`}
                >
                  {bn(i + 1)}
                </span>
                <Ink p={p(row.key)} inline className="font-display text-[26px] font-semibold tracking-tight text-padma-ink">
                  {i === 2 ? (
                    <>
                      {mathLine("x = ২৭ ÷ ৩ = ")}
                      <span className="relative inline-block px-1 text-ink">
                        ৯
                        <svg className="pointer-events-none absolute -top-[18%] -left-[30%] h-[136%] w-[160%] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                          <path d={CIRCLE} pathLength="1" fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1" strokeDashoffset={1 - p("circle")} />
                        </svg>
                      </span>
                    </>
                  ) : (
                    mathLine(COPY.steps[i])
                  )}
                </Ink>
              </div>
            ))}

            <Ink p={p("sideNote")} className="font-display text-[17px] font-semibold text-shapla-ink" style={{ top: ROW.step1 + 6, left: 360 }}>
              ← {COPY.sideNote}
            </Ink>

            <div
              className={`absolute w-[456px] -rotate-[0.6deg] rounded-xl border-2 border-ink bg-marigold-soft px-4 py-3 shadow-hard-sm transition-[opacity,transform] duration-500 ${
                p("note") > 0 ? "opacity-100" : "translate-y-2 opacity-0"
              }`}
              style={{ top: ROW.note, left: 32 }}
            >
              <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-wide text-ember-ink">
                <Icon name="notes" className="size-4" strokeWidth={2.2} />
                {COPY.note.title}
              </p>
              <div className="relative mt-1 h-[52px]">
                <Ink p={p("note")} className="top-0 left-0 max-w-none text-[16px] leading-snug text-ink">
                  <span className="block w-[424px] whitespace-normal">{COPY.note.text}</span>
                </Ink>
              </div>
            </div>

            <div className="absolute flex items-center gap-2" style={{ top: ROW.check, left: 32 }}>
              <Ink p={p("check")} inline className="font-display text-[22px] font-semibold text-kolapata">
                <span className="numerals-bn">{COPY.check}</span>
              </Ink>
              <svg className="size-7 shrink-0 overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
                <path d={TICK} pathLength="1" fill="none" stroke="var(--color-kolapata)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset={1 - p("tick")} />
              </svg>
            </div>
          </div>
        </div>

        <span
          key={tool}
          className="animate-rise-in absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-ink shadow-hard-sm"
        >
          <Icon name={TOOL_ICON[tool]} className="size-3.5 text-ember" strokeWidth={2.2} />
          {COPY.tools[tool]}
        </span>
        <span
          className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[0.7rem] font-semibold text-white transition-[opacity,transform] duration-300 ${
            toast ? "opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          <Icon name="check" className="size-3.5 text-marigold" strokeWidth={2.6} />
          {COPY.noteSaved}
        </span>

        <div
          className={`absolute inset-x-2.5 bottom-2.5 rounded-2xl border-2 border-ink bg-white p-3 shadow-hard transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] sm:inset-x-4 sm:bottom-4 ${
            cardOpen ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[0.66rem] font-bold tracking-wide text-ember-ink">
            <Icon name="chat" className="size-3.5" strokeWidth={2.2} />
            {COPY.teacher}
          </p>
          <p className="mt-0.5 text-[0.84rem] leading-snug font-semibold">{COPY.question}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-full border-2 border-ink/70 bg-paper px-3 text-[0.8rem]">
              {typedText ? (
                <span className="truncate">{typedText}</span>
              ) : (
                <span className="truncate text-ink-muted">{COPY.answerLabel}…</span>
              )}
              {typedText && typedP < 1 && caretOn ? <span className="ml-px h-4 w-0.5 bg-ink" /> : null}
            </div>
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-marigold text-ink transition-[transform,box-shadow] ${
                sending ? "translate-y-px scale-90 shadow-none" : "shadow-hard-sm"
              }`}
            >
              <Icon name="send" className="size-3.5" strokeWidth={2.2} />
            </span>
          </div>
          {feedback ? (
            <p
              className={`animate-rise-in mt-2 flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-[0.74rem] leading-snug font-medium ${
                feedback === "hint" ? "bg-coral-soft text-shapla-ink" : "bg-kolapata-soft text-kolapata"
              }`}
            >
              <Icon name={feedback === "hint" ? "lightbulb" : "check"} className="mt-px size-3.5 shrink-0" strokeWidth={2.4} />
              {feedback === "hint" ? COPY.hint : COPY.right}
            </p>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-1 bg-ink/5">
          <div className="h-full bg-marigold" style={{ width: `${(now / LOOP) * 100}%` }} />
        </div>
      </div>

      <div aria-hidden="true" className="relative flex items-end gap-2.5 border-t-2 border-ink bg-paper-deep/60 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span
            className={`relative block size-11 overflow-hidden rounded-full border-2 border-ink bg-white transition-shadow sm:size-12 ${
              teacherTalking ? "shadow-[0_0_0_3px_var(--color-marigold)]" : ""
            }`}
            style={{ "--mouth": mouth.toFixed(3) } as CSSProperties}
          >
            <TeacherAvatar talking={teacherTalking} />
          </span>
          <span className="text-[0.6rem] font-semibold text-ink-muted">{COPY.teacher}</span>
        </div>
        <p
          key={line.at}
          className={`animate-rise-in mb-4 min-h-[2.6em] flex-1 rounded-2xl border-2 border-ink px-3 py-2 text-[0.8rem] leading-snug sm:text-[0.86rem] ${
            line.who === "teacher" ? "rounded-bl-md bg-white" : "rounded-br-md bg-marigold-soft text-right"
          }`}
        >
          {line.text}
        </p>
        <div className="relative flex shrink-0 flex-col items-center gap-1">
          <span
            className={`relative block size-11 overflow-hidden rounded-full border-2 border-ink bg-white transition-shadow sm:size-12 ${
              line.who === "student" ? "shadow-[0_0_0_3px_var(--color-marigold)]" : ""
            }`}
          >
            <StudentAvatar />
          </span>
          <span
            className={`absolute -top-3 -right-1 grid size-6 place-items-center rounded-full border-2 border-ink bg-marigold transition-[opacity,transform] duration-300 ${
              handUp ? "opacity-100" : "translate-y-1 scale-75 opacity-0"
            }`}
          >
            <Icon name="hand" className="size-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-[0.6rem] font-semibold text-ink-muted">{COPY.you}</span>
        </div>
      </div>
    </div>
  );
}
