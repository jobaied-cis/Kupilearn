"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

export type RoleMode = "login" | "signup";

const APP = "https://classroom-impactx.vercel.app";

const COPY: Record<
  RoleMode,
  {
    badge: string;
    title: string;
    sub: string;
    cta: string;
    switchPrompt: string;
    switchLabel: string;
    other: RoleMode;
  }
> = {
  login: {
    badge: "আবার স্বাগতম",
    title: "কে লগইন করছ?",
    sub: "বেছে নাও — প্রত্যেকের জন্য আলাদা জায়গা।",
    cta: "লগইন",
    switchPrompt: "নতুন এখানে?",
    switchLabel: "বিনামূল্যে অ্যাকাউন্ট খোলো",
    other: "signup",
  },
  signup: {
    badge: "বিনামূল্যে শুরু",
    title: "কার জন্য অ্যাকাউন্ট?",
    sub: "বেছে নাও — তারপর এক মিনিটেই অ্যাকাউন্ট তৈরি।",
    cta: "অ্যাকাউন্ট খোলো",
    switchPrompt: "আগেই অ্যাকাউন্ট আছে?",
    switchLabel: "লগইন করো",
    other: "login",
  },
};

const RoleDialogContext = createContext<{ open: (mode: RoleMode) => void }>({
  open: () => {},
});

export const useRoleDialog = () => useContext(RoleDialogContext);

/** Mirrors the demo: modified clicks still follow the href. */
export function roleClick(open: (mode: RoleMode) => void, mode: RoleMode) {
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(mode);
  };
}

function RoleCard({
  mode,
  role,
}: {
  mode: RoleMode;
  role: "student" | "guardian";
}) {
  const student = role === "student";
  return (
    <li className="flex">
      <a
        data-guide={student ? "role-student" : "role-guardian"}
        className={`group flex w-full items-center gap-4 rounded-[1.4rem] border-2 border-ink bg-white p-4 text-left shadow-hard-sm transition-[translate,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none sm:flex-col sm:gap-3 sm:p-5 sm:text-center ${
          student ? "hover:bg-marigold-soft/60" : "hover:bg-lagoon-soft/60"
        }`}
        href={`${APP}/${mode}/${role}`}
      >
        <span
          aria-hidden="true"
          className={`grid size-14 shrink-0 place-items-center rounded-full border-2 border-ink sm:size-18 ${
            student ? "bg-flame text-night" : "bg-lagoon text-white"
          }`}
        >
          <Icon name={student ? "cap" : "shield"} className="size-7 sm:size-8" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[1.35rem] leading-tight font-extrabold text-ink">
            {student ? "শিক্ষার্থী" : "অভিভাবক"}
          </span>
          <span className="block text-[0.82rem] font-semibold text-ink-muted">
            {student ? "ষষ্ঠ–দশম শ্রেণি" : "মা, বাবা বা অভিভাবক"}
          </span>
          <span className="mt-2 hidden flex-col gap-1 sm:flex">
            {(student
              ? ["AI শিক্ষকের সাথে ক্লাস", "রিভিশন, গেম আর অগ্রগতি"]
              : ["সন্তানের শেখার খবর", "সাপ্তাহিক রিপোর্ট (শীঘ্রই)"]
            ).map((line) => (
              <span key={line} className="inline-flex items-center justify-center gap-1.5 text-[0.8rem] text-ink-soft">
                <Icon name="check" className={`size-3.5 shrink-0 ${student ? "text-ember" : "text-padma-ink"}`} strokeWidth={3} />
                {line}
              </span>
            ))}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.82rem] font-bold text-ink transition-colors group-hover:bg-flame sm:mt-1">
          <span className="hidden sm:inline">{COPY[mode].cta}</span>
          <Icon name="arrow" className="size-4" strokeWidth={2.4} />
        </span>
      </a>
    </li>
  );
}

export function RoleDialogProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<RoleMode>("login");

  const open = useCallback((next: RoleMode) => {
    setMode(next);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const copy = COPY[mode];
  return (
    <RoleDialogContext.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="role-dialog-title"
        className="m-auto w-[min(40rem,calc(100vw-1.5rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink/50"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="relative rounded-[2rem] border-2 border-ink bg-paper px-5 pt-8 pb-6 shadow-hard-lg sm:px-9 sm:pt-10 sm:pb-8">
          <div aria-hidden="true" className="texture-grid pointer-events-none absolute inset-0 rounded-[2rem] opacity-50" />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full border-2 border-ink bg-white text-ink transition-colors hover:bg-sand"
          >
            <Icon name="close" className="size-4.5" strokeWidth={2.4} />
            <span className="sr-only">বন্ধ করো</span>
          </button>
          <div className="relative">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-[0.8rem] font-bold text-ember-ink">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-flame" />
                {copy.badge}
              </span>
              <h2 id="role-dialog-title" className="mt-3 text-[clamp(1.7rem,4.5vw,2.3rem)] leading-tight text-ink">
                {copy.title}
              </h2>
              <p className="mt-1 text-[0.95rem] text-ink-soft">{copy.sub}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
                <RoleCard mode={mode} role="student" />
                <RoleCard mode={mode} role="guardian" />
              </ul>
              <div className="mt-5 text-[0.92rem] text-ink-soft">
                {copy.switchPrompt}{" "}
                <button
                  type="button"
                  onClick={() => setMode(copy.other)}
                  className="font-bold text-brand-700 underline decoration-flame decoration-2 underline-offset-4 hover:text-brand-600"
                >
                  {copy.switchLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </RoleDialogContext.Provider>
  );
}
