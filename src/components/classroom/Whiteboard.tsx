"use client";

import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Icon } from "../Icon";
import type { VizInstruction } from "../../lib/lesson/engine";

function Equation({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: false });
    } catch {
      return tex;
    }
  }, [tex]);
  return <span className="text-[1.05rem] text-paper" dangerouslySetInnerHTML={{ __html: html }} />;
}

function VizStep({ step }: { step: VizInstruction }) {
  if (step.kind === "equation") {
    return (
      <div className="rounded-xl bg-white/8 px-3 py-2">
        <Equation tex={step.content} />
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
      <figure>
        <figcaption className="mb-2 text-[0.85rem] font-semibold text-brand-200">{step.content}</figcaption>
        <div className="flex items-end gap-3" role="img" aria-label={step.content}>
          {bars.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-flame transition-all duration-700" style={{ height: `${Math.max(8, (b.value / max) * 72)}px` }} />
              <span className="text-[0.65rem] text-brand-100/70">{b.label}</span>
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
        <figcaption className="mb-2 text-[0.85rem] font-semibold text-brand-200">{step.content}</figcaption>
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((i, idx) => (
            <li key={i.when} className="flex items-center gap-2">
              <span className="rounded-full border border-flame/60 bg-flame/15 px-2.5 py-1 text-[0.72rem] font-bold text-flame">{i.when}: {i.what}</span>
              {idx < items.length - 1 ? <span aria-hidden="true" className="text-brand-300">→</span> : null}
            </li>
          ))}
        </ol>
      </figure>
    );
  }
  if (step.kind === "diagram") {
    return (
      <figure className="rounded-xl bg-white/8 p-3">
        <svg viewBox="0 0 320 120" className="w-full" role="img" aria-label={step.content}>
          <path d="M160 108 C150 70 150 40 160 12" stroke="#7ee2a0" strokeWidth="4" fill="none" />
          <ellipse cx="118" cy="42" rx="42" ry="16" fill="#267a4d" transform="rotate(-24 118 42)" />
          <ellipse cx="204" cy="36" rx="42" ry="16" fill="#2f9e5f" transform="rotate(20 204 36)" />
          <circle cx="272" cy="24" r="14" fill="#ffb020" />
          <path d="M258 66 h44 M292 60 l8 6 -8 6" stroke="#ffb020" strokeWidth="3" fill="none" />
          <text x="30" y="112" fill="#e6edfb" fontSize="11">sunlight → food (photosynthesis)</text>
        </svg>
        <figcaption className="mt-1 text-center text-[0.78rem] text-brand-100/70">{step.content}</figcaption>
      </figure>
    );
  }
  if (step.kind === "highlight") {
    return <p className="rounded-lg bg-flame/20 px-3 py-2 font-semibold text-flame">{step.content}</p>;
  }
  if (step.kind === "label") {
    return <p className="inline-block rounded-full border border-brand-300/50 px-3 py-1 text-[0.8rem] font-semibold text-brand-200">{step.content}</p>;
  }
  if (step.kind === "clear") return null;
  return <p className="font-display text-[1.02rem] leading-snug text-paper">{step.content}</p>;
}

/**
 * Interactive AI whiteboard: animated step-by-step board instructions with
 * pause / replay / zoom, and the current line as a subtitle.
 */
export function Whiteboard({ steps, title, subtitle }: { steps: VizInstruction[]; title: string; subtitle?: string }) {
  const visible = useMemo(() => steps.filter((s) => s.kind !== "clear"), [steps]);
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setShown(1);
      setPlaying(true);
    });
    return () => cancelAnimationFrame(id);
  }, [steps]);

  useEffect(() => {
    if (!playing || shown >= visible.length) return;
    const id = setTimeout(() => setShown((n) => Math.min(visible.length, n + 1)), 1400);
    return () => clearTimeout(id);
  }, [playing, shown, visible.length]);

  const current = visible[Math.max(0, shown - 1)];

  return (
    <section aria-label="AI whiteboard" className="relative overflow-hidden rounded-2xl border-2 border-ink bg-board text-brand-50 shadow-hard-sm">
      <div aria-hidden="true" className="texture-grid-board pointer-events-none absolute inset-0 opacity-70" />
      <header className="relative flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-flame text-night"><Icon name="board" className="size-4.5" strokeWidth={1.9} /></span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[1rem] font-bold text-paper">{title}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPlaying((p) => !p)} className="grid size-9 place-items-center rounded-full border border-white/25 text-paper hover:bg-white/10" aria-label={playing ? "Pause" : "Play"}>
            <Icon name={playing ? "pause" : "play"} className="size-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => { setShown(1); setPlaying(true); }} className="grid size-9 place-items-center rounded-full border border-white/25 text-paper hover:bg-white/10" aria-label="Replay">
            <Icon name="refresh" className="size-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => setZoom((z) => (z >= 1.4 ? 0.9 : +(z + 0.25).toFixed(2)))} className="h-9 rounded-full border border-white/25 px-3 text-[0.78rem] font-bold text-paper hover:bg-white/10" aria-label="Zoom">
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </header>
      <div className="relative max-h-[26rem] min-h-56 overflow-auto px-4 py-3">
        <div className="flex flex-col gap-2.5 transition-transform" style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
          {visible.slice(0, shown).map((step, i) => (
            <div key={i} className="animate-rise-in"><VizStep step={step} /></div>
          ))}
          {visible.length === 0 ? <p className="text-brand-100/60">The teacher will write here…</p> : null}
        </div>
      </div>
      <footer className="relative border-t border-white/10 px-4 py-2">
        <p className="truncate text-[0.82rem] text-brand-100/75" aria-live="polite">
          <span className="font-bold text-flame">Subtitle: </span>{subtitle ?? current?.content ?? "…"}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-flame transition-all duration-500" style={{ width: `${visible.length ? (shown / visible.length) * 100 : 0}%` }} />
        </div>
      </footer>
    </section>
  );
}
