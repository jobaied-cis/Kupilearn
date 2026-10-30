"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { VizInstruction } from "../../lib/lesson/engine";
import { writeIntervalMs } from "../../lib/classroom/schedule";
import { TOPIC_GAP, TOPIC_W, boardWidth, cameraForTopic, cameraTransform, type Camera } from "../../lib/classroom/boardCamera";

function Equation({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: false });
    } catch {
      return tex;
    }
  }, [tex]);
  return <span className="text-[1.3rem] text-[#1d4ed8]" dangerouslySetInnerHTML={{ __html: html }} />;
}

const MARKERS = ["text-[#111827]", "text-[#1d4ed8]", "text-[#b91c1c]", "text-[#047857]"];

function VizStep({ step, speed, index, instant }: { step: VizInstruction; speed: number; index: number; instant: boolean }) {
  const isText = step.kind === "write" || step.kind === "highlight" || step.kind === "label";
  const full = step.content;
  const [chars, setChars] = useState(instant || (!isText && step.kind !== "equation") ? full.length : 0);

  useEffect(() => {
    if (instant || (!isText && step.kind !== "equation") || chars >= full.length) return;
    const id = setTimeout(() => setChars((c) => Math.min(full.length, c + 2)), writeIntervalMs(speed));
    return () => clearTimeout(id);
  }, [chars, full, instant, isText, step.kind, speed]);

  const typed = full.slice(0, chars);
  const done = chars >= full.length;
  const marker = MARKERS[index % MARKERS.length];

  if (step.kind === "equation") {
    return (
      <div className="rounded-lg border-2 border-dashed border-[#93c5fd] bg-[#eff6ff] px-3.5 py-2.5">
        {done ? <Equation tex={full} /> : <span className="font-mono text-[1.05rem] text-[#1d4ed8]">{typed}<span aria-hidden="true" className="animate-blink">▌</span></span>}
      </div>
    );
  }
  if (step.kind === "chart") {
    const bars = (step.data ?? "").split(",").map((p) => {
      const [label, v] = p.split(":");
      return { label: (label ?? "").trim(), value: Number(v) || 0 };
    }).filter((b) => b.label);
    const max = Math.max(1, ...bars.map((b) => b.value));
    return (
      <figure className="max-w-md">
        <figcaption className="mb-2 font-display text-[1.05rem] font-bold text-[#111827]">{full}</figcaption>
        <div className="flex items-end gap-3 border-b-2 border-l-2 border-[#9ca3af] px-2" role="img" aria-label={full}>
          {bars.map((b, i) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[0.72rem] font-bold text-[#374151]">{b.value}</span>
              <div className="w-full rounded-t-sm bg-[#2563eb] transition-all duration-1000" style={{ height: `${Math.max(10, (b.value / max) * 84)}px`, transitionDelay: `${i * 160}ms` }} />
              <span className="pb-1 text-[0.68rem] font-semibold text-[#4b5563]">{b.label}</span>
            </div>
          ))}
        </div>
      </figure>
    );
  }
  if (step.kind === "timeline") {
    const items = (step.data ?? "").split("|").map((p) => {
      const [when, what] = p.split(":");
      return { when: (when ?? "").trim(), what: (what ?? "").trim() };
    }).filter((i) => i.when);
    return (
      <figure>
        <figcaption className="mb-2 font-display text-[1.05rem] font-bold text-[#111827]">{full}</figcaption>
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((i, idx) => (
            <li key={i.when} className="flex items-center gap-2">
              <span className="rounded-full border-2 border-[#b91c1c] bg-[#fef2f2] px-3 py-1 text-[0.8rem] font-bold text-[#991b1b]">{i.when}: {i.what}</span>
              {idx < items.length - 1 ? <span aria-hidden="true" className="font-bold text-[#9ca3af]">→</span> : null}
            </li>
          ))}
        </ol>
      </figure>
    );
  }
  if (step.kind === "diagram") {
    return (
      <figure className="max-w-md rounded-lg border-2 border-dashed border-[#6ee7b7] bg-[#ecfdf5] p-3">
        <svg viewBox="0 0 340 130" className="w-full" role="img" aria-label={full}>
          <line x1="20" y1="110" x2="320" y2="110" stroke="#047857" strokeWidth="3" />
          <path d="M170 110 C162 78 162 48 170 18" stroke="#059669" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="126" cy="48" rx="44" ry="16" fill="#34d399" transform="rotate(-22 126 48)" />
          <ellipse cx="216" cy="42" rx="44" ry="16" fill="#10b981" transform="rotate(18 216 42)" />
          <circle cx="292" cy="28" r="15" fill="#f59e0b" />
          <path d="M272 78 h48 M310 71 l9 7 -9 7" stroke="#f59e0b" strokeWidth="3" fill="none" />
          <text x="22" y="126" fill="#065f46" fontSize="11" fontWeight="700">{full.slice(0, 44)}</text>
        </svg>
        <figcaption className="mt-1 text-center font-display text-[0.9rem] font-bold text-[#065f46]">{full}</figcaption>
      </figure>
    );
  }
  if (step.kind === "highlight") {
    return <p className="inline-block max-w-full rounded-md bg-[#fef08a] px-3 py-1.5 font-display text-[1.1rem] font-bold text-[#713f12]">{typed}{!done ? <span aria-hidden="true" className="animate-blink">▌</span> : null}</p>;
  }
  if (step.kind === "label") {
    return <p className="inline-block rounded-full border-2 border-[#2563eb] px-3 py-1 font-display text-[0.88rem] font-bold text-[#1d4ed8]">{typed}</p>;
  }
  if (step.kind === "clear") return null;
  // Written lines containing formulas/fractions render with KaTeX once written.
  if (done && /\\(frac|sqrt|times|div|leq|geq|neq)|[\^_]\{/.test(full)) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[#93c5fd] bg-[#eff6ff] px-3.5 py-2.5">
        <Equation tex={full} />
      </div>
    );
  }
  return (
    <p className={`font-display text-[1.35rem] leading-snug font-bold ${marker}`}>
      {typed}
      {!done ? <span aria-hidden="true" className="animate-blink font-normal">▌</span> : null}
    </p>
  );
}

export interface BoardSection {
  title: string;
  steps: VizInstruction[];
  /** Meta-generated topic visualization (data URL), when available. */
  image?: string | null;
}

/**
 * One continuous whiteboard with no topic boxes or cards. Each topic is
 * a column of writing added to the RIGHT of the previous one; a column
 * grows vertically as tall as its content needs. Finished topics stay
 * written, the current topic is written live, later topics wait as
 * plain titles. The camera follows the teacher; students can drag/zoom.
 */
export function Whiteboard({ sections, activeIdx, speed = 1 }: { sections: BoardSection[]; activeIdx: number; speed?: number }) {
  const totalWidth = boardWidth(sections.length);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 1100, h: 560 });
  const [userZoom, setUserZoom] = useState(1);
  const [following, setFollowing] = useState(true);
  const [manual, setManual] = useState<Camera | null>(null);
  const [shown, setShown] = useState(1);
  const dragRef = useRef<{ px: number; py: number; cam: Camera } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const active = sections[activeIdx];
  useEffect(() => {
    const id = requestAnimationFrame(() => { setShown(1); setFollowing(true); setManual(null); });
    return () => cancelAnimationFrame(id);
  }, [activeIdx]);

  useEffect(() => {
    if (!active || shown >= active.steps.length) return;
    const current = active.steps[shown - 1];
    const writeMs = current ? Math.min(4200, Math.max(700, current.content.length * writeIntervalMs(speed) * 0.6)) : 900;
    const id = setTimeout(() => setShown((n) => Math.min(active.steps.length, n + 1)), writeMs);
    return () => clearTimeout(id);
  }, [shown, active, speed]);

  const teacherCam = cameraForTopic(activeIdx, viewport, userZoom);
  const cam = following || !manual ? teacherCam : manual;

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { px: e.clientX, py: e.clientY, cam };
    setDragging(true);
    setFollowing(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setManual({ ...d.cam, x: d.cam.x + (e.clientX - d.px), y: d.cam.y + (e.clientY - d.py) });
  }
  function endDrag() { dragRef.current = null; setDragging(false); }

  return (
    <section aria-label="Teacher's whiteboard" className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-[6px] border-[#9ca3af] bg-white shadow-[inset_0_0_60px_rgba(0,0,0,0.05)]">
      <div ref={wrapRef} className="relative flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div
          className="absolute top-0 left-0 flex items-start"
          style={{
            width: totalWidth,
            gap: TOPIC_GAP,
            minHeight: "100%",
            transform: cameraTransform(cam),
            transformOrigin: "0 0",
            transition: dragging ? "none" : "transform 900ms cubic-bezier(0.22,1,0.36,1)",
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 34px, #eef0f3 34px 35px)",
          }}
        >
          {sections.map((sec, i) => {
            const mode = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
            return (
              <article key={sec.title} className="shrink-0 px-8 pt-2 pb-16" style={{ width: TOPIC_W }}>
                <h2 className={`font-display text-[1.7rem] font-bold underline decoration-4 underline-offset-4 ${mode === "todo" ? "text-[#9ca3af] decoration-[#e5e7eb]" : "text-[#111827] decoration-[#f59e0b]"}`}>
                  {i + 1}. {sec.title}
                  {mode === "active" ? <span className="ml-3 align-middle font-sans text-[0.72rem] font-bold tracking-wide text-[#b45309] uppercase">Now teaching</span> : null}
                </h2>
                {mode === "todo" ? (
                  <p className="mt-4 font-display text-[1.05rem] text-[#9ca3af]">Your teacher will write here — to the right of the previous topic — when the class reaches this topic.</p>
                ) : (
                  <div className="mt-4 flex items-start gap-6">
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-3.5">
                      {(mode === "done" ? sec.steps : sec.steps.slice(0, shown)).map((step, j) => (
                        <div key={j} className="animate-rise-in max-w-full"><VizStep step={step} speed={speed} index={j} instant={mode === "done"} /></div>
                      ))}
                    </div>
                    {sec.image ? (
                      <figure className="min-w-0 shrink-0 basis-[35%] self-start overflow-hidden" style={{ maxWidth: "35%" }}>
                        {/* Meta topic picture: 35% of this topic column,
                            fixed aspect box, contained in the column. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sec.image} alt={`Visualization for ${sec.title}`} className="block aspect-[4/3] w-full rounded-lg border-2 border-[#d1d5db] bg-white object-contain" />
                        <figcaption className="mt-1 truncate text-center text-[0.72rem] font-semibold text-[#6b7280]">Teacher picture · Meta AI</figcaption>
                      </figure>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="relative flex items-center gap-1.5 px-3 py-2">
        <span className="mr-1 hidden text-[0.72rem] font-bold text-[#6b7280] sm:block">Drag the board to look around · all topics stay on the board</span>
        <span className="flex-1" />
        <button type="button" onClick={() => { setUserZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2))); setFollowing(true); }} className="grid size-8 place-items-center rounded-full border-2 border-ink bg-white text-sm font-bold" aria-label="Zoom out">−</button>
        <span className="min-w-12 text-center text-[0.75rem] font-bold text-[#374151]">{Math.round(userZoom * 100)}%</span>
        <button type="button" onClick={() => { setUserZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2))); setFollowing(true); }} className="grid size-8 place-items-center rounded-full border-2 border-ink bg-white text-sm font-bold" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => { setFollowing(true); setManual(null); }} className={`rounded-full border-2 border-ink px-3 py-1.5 text-[0.75rem] font-bold ${following ? "bg-flame text-night" : "bg-white text-ink"}`}>Follow teacher</button>
      </div>
    </section>
  );
}
