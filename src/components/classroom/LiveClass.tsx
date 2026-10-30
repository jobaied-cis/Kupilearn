"use client";

import { useRef, useState, type ReactNode } from "react";
import { Icon } from "../Icon";
import { Whiteboard, type BoardSection } from "./Whiteboard";
import { AnimatedAvatar } from "./AnimatedAvatar";
import type { TeacherCard, ClassmateCard } from "../../lib/classroom/catalog";
import { SPEED_OPTIONS, type ClassSpeed } from "../../lib/classroom/schedule";

export type LiveMsg = { who: string; role: string; text: string; color: string };

const TOOL_BTN = "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-2 text-[0.8rem] font-bold text-ink shadow-hard-sm transition-transform hover:-translate-y-px";

function Avatar({ name, color, speaking, reacting, big, gender }: { name: string; color: string; speaking: boolean; reacting?: boolean; big?: boolean; gender: "male" | "female" }) {
  return <AnimatedAvatar name={name} color={color} speaking={speaking} reacting={reacting} big={big} gender={gender} />;
}

export interface LiveClassProps {
  teacher: TeacherCard;
  mates: ClassmateCard[];
  activeSpeaker: string | null;
  subtitle: { who: string; text: string } | null;
  boardSections: BoardSection[];
  activeTopicIdx: number;
  topicLabel: string;
  sourceLabel: string | null;
  speed: ClassSpeed;
  onSpeedChange: (s: ClassSpeed) => void;
  paused: boolean;
  onTogglePause: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  onExit: () => void;
  onDownloadNotes: () => void;
  completedTopics: string[];
  currentTopic: string;
  remainingTopics: string[];
  statsLine: string;
  providerLine: string;
  msgs: LiveMsg[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  /** Meta STT: recorded audio (base64, format) to transcribe and ask. */
  onSpeech: (audioBase64: string, format: string) => void;
  busy: boolean;
  answerPanel: ReactNode;
}

export function LiveClass(p: LiveClassProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const format = blob.type.includes("wav") ? "wav" : blob.type.includes("ogg") ? "ogg" : "webm";
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? "");
          const b64 = dataUrl.split(",")[1];
          if (b64) p.onSpeech(b64, format);
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setRecording(true);
    } catch { /* microphone unavailable — typing still works */ }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#e8eaed]" role="region" aria-label="Live AI classroom">
      {/* Whiteboard fills the screen */}
      <div className="min-h-0 flex-1 p-2 pb-40 sm:p-3 sm:pb-36">
        <Whiteboard sections={p.boardSections} activeIdx={p.activeTopicIdx} speed={p.speed} />
      </div>

      {/* Top-left: History · Top-right: Notes + Speed */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <button type="button" className={TOOL_BTN} onClick={() => setHistoryOpen(true)} aria-label="View learning history">
          <Icon name="clock" className="size-4" strokeWidth={2} /> History
        </button>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="pointer-events-auto hidden items-center rounded-full bg-night/80 px-3 py-2 text-[0.72rem] font-bold text-paper md:inline-flex">{p.topicLabel}{p.sourceLabel ? ` · ${p.sourceLabel}` : ""} · {p.providerLine}</span>
          <button type="button" className={TOOL_BTN} onClick={p.onDownloadNotes}>
            <Icon name="download" className="size-4" strokeWidth={2} /> Download Notes
          </button>
          <div className="pointer-events-auto relative">
            <button type="button" className={TOOL_BTN} aria-expanded={speedOpen} onClick={() => setSpeedOpen((v) => !v)}>
              <Icon name="chart" className="size-4" strokeWidth={2} /> Speed {p.speed}x
            </button>
            {speedOpen ? (
              <div className="absolute right-0 mt-1.5 w-44 rounded-xl border-2 border-ink bg-white p-1.5 shadow-hard-sm" role="group" aria-label="Class speed settings">
                <p className="px-2 py-1 text-[0.7rem] font-bold tracking-wide text-ink-muted uppercase">Class Speed</p>
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} type="button" aria-pressed={p.speed === s} onClick={() => { p.onSpeedChange(s); setSpeedOpen(false); }} className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[0.82rem] font-bold ${p.speed === s ? "bg-flame text-night" : "text-ink hover:bg-paper"}`}>
                    {s}x{s === 0.75 ? " · Slow & calm" : s === 1 ? " · Normal" : s === 1.25 ? " · Brisk" : " · Fast"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className={TOOL_BTN} onClick={p.onTogglePause} aria-label={p.paused ? "Resume class" : "Pause class"}>
            <Icon name={p.paused ? "play" : "pause"} className="size-4" strokeWidth={2} /> {p.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className={TOOL_BTN} onClick={p.onToggleVoice} aria-pressed={p.voiceOn}>Voice {p.voiceOn ? "On" : "Off"}</button>
          <button type="button" className={TOOL_BTN} onClick={p.onExit} aria-label="End class"><Icon name="close" className="size-4" strokeWidth={2} /></button>
        </div>
      </div>

      {/* Teacher avatar — bottom-left */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-5">
        <Avatar name={p.teacher.name} color={p.teacher.color} gender={p.teacher.gender} big speaking={p.activeSpeaker === p.teacher.name} reacting={!!p.subtitle && p.subtitle.who !== p.teacher.name} />
      </div>

      {/* Classmate avatars + student microphone — bottom-right */}
      <div className="absolute right-3 bottom-3 flex items-end gap-2.5 sm:right-5 sm:bottom-4" aria-label="AI classmates">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-pressed={recording}
            aria-label={recording ? "Stop recording — Meta will transcribe your question" : "Ask your teacher by voice (Meta speech-to-text)"}
            className={`grid size-12 place-items-center rounded-full border-[3px] font-bold shadow-hard-sm transition-all sm:size-14 ${recording ? "avatar-speaking animate-pulse border-coral bg-coral text-white" : "border-ink bg-flame text-night hover:-translate-y-0.5"}`}
          >
            <Icon name="chat" className="size-5" strokeWidth={2} />
          </button>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${recording ? "bg-coral text-white" : "bg-night/70 text-paper"}`}>{recording ? "Listening…" : "Ask by voice"}</span>
        </div>
        {p.mates.map((m) => (
          <Avatar key={m.id} name={m.name} color={m.color} gender={m.gender} speaking={p.activeSpeaker === m.name} reacting={!!p.subtitle && p.subtitle.who !== m.name && p.activeSpeaker !== m.name} />
        ))}
      </div>

      {/* Live subtitles — bottom-center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-24 sm:bottom-5" aria-live="polite">
        {p.subtitle ? (
          <p className="max-w-2xl rounded-xl bg-night/88 px-4 py-2.5 text-center text-[0.9rem] leading-snug text-paper shadow-hard-sm">
            <strong className="mr-1.5 text-flame">{p.subtitle.who}:</strong>{p.subtitle.text}
          </p>
        ) : null}
      </div>

      {/* Student answer panel (appears only when the teacher asks the student) */}
      {p.answerPanel}

      {/* Chatbox — minimized by default */}
      <div className="absolute right-3 bottom-24 sm:right-5 sm:bottom-24">
        {chatOpen ? (
          <section className="flex max-h-[26rem] w-[19rem] flex-col rounded-2xl border-2 border-ink bg-white shadow-hard-sm" aria-label="Ask a question">
            <header className="flex items-center justify-between border-b border-paper-edge px-3 py-2">
              <h2 className="font-display text-[0.9rem] font-bold text-ink">Ask your teacher</h2>
              <button type="button" onClick={() => setChatOpen(false)} className="grid size-7 place-items-center rounded-full border border-ink/20" aria-label="Minimize chat"><Icon name="close" className="size-3.5" strokeWidth={2.2} /></button>
            </header>
            <ul className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
              {p.msgs.slice(-8).map((m, i) => (
                <li key={i} className="text-[0.78rem] leading-snug"><strong className="text-ink">{m.who}: </strong><span className="text-ink-soft">{m.text}</span></li>
              ))}
            </ul>
            <div className="flex gap-1.5 border-t border-paper-edge p-2">
              <input autoFocus value={p.input} onChange={(e) => p.onInputChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && p.onSend()} placeholder="I don't understand…" className="h-9 min-w-0 flex-1 rounded-full border-2 border-ink bg-paper px-3 text-sm text-ink outline-none" />
              <button type="button" onClick={() => void toggleMic()} aria-pressed={recording} className={`grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink disabled:opacity-50 ${recording ? "animate-pulse bg-coral text-white" : "bg-white text-ink"}`} aria-label={recording ? "Stop recording and ask with Meta speech-to-text" : "Ask by voice (Meta speech-to-text)"}><Icon name="chat" className="size-4" strokeWidth={2} /></button>
              <button type="button" disabled={p.busy || !p.input.trim()} onClick={p.onSend} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-flame text-night disabled:opacity-50" aria-label="Send question"><Icon name="send" className="size-4" strokeWidth={2} /></button>
            </div>
          </section>
        ) : (
          <button type="button" onClick={() => setChatOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-night px-4 py-2.5 text-[0.82rem] font-bold text-paper shadow-hard-sm" aria-label="Open chat to ask a question">
            <Icon name="chat" className="size-4" strokeWidth={2} /> Ask a question
          </button>
        )}
      </div>

      {/* History drawer */}
      {historyOpen ? (
        <div className="absolute inset-0 z-10 bg-night/40" role="dialog" aria-label="Learning history" onClick={() => setHistoryOpen(false)}>
          <aside className="flex h-full w-[19rem] max-w-[86vw] flex-col bg-white p-4 shadow-hard-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Your Learning History</h2>
              <button type="button" onClick={() => setHistoryOpen(false)} className="grid size-8 place-items-center rounded-full border-2 border-ink" aria-label="Close history"><Icon name="close" className="size-4" strokeWidth={2.2} /></button>
            </div>
            <p className="mt-1 text-[0.82rem] font-semibold text-ink-soft">{p.statsLine}</p>
            <h3 className="mt-4 text-[0.75rem] font-bold tracking-wide text-kolapata uppercase">Completed topics</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {p.completedTopics.length ? p.completedTopics.map((t) => <li key={t} className="flex items-center gap-1.5 rounded-lg bg-kolapata-soft px-2.5 py-1.5 text-[0.83rem] font-semibold text-ink"><Icon name="check" className="size-3.5 text-kolapata" strokeWidth={2.6} />{t}</li>) : <li className="text-[0.83rem] text-ink-muted">No topics completed yet — the class is underway.</li>}
            </ul>
            <h3 className="mt-4 text-[0.75rem] font-bold tracking-wide text-brand-700 uppercase">Now learning</h3>
            <p className="mt-1.5 rounded-lg bg-marigold-soft px-2.5 py-1.5 text-[0.83rem] font-semibold text-ink">{p.currentTopic}</p>
            <h3 className="mt-4 text-[0.75rem] font-bold tracking-wide text-ink-muted uppercase">Still remaining</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {p.remainingTopics.length ? p.remainingTopics.map((t) => <li key={t} className="rounded-lg bg-paper px-2.5 py-1.5 text-[0.83rem] font-semibold text-ink-soft">{t}</li>) : <li className="text-[0.83rem] text-ink-muted">Nothing left — this is the last topic.</li>}
            </ul>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
