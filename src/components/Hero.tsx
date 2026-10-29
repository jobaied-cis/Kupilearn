"use client";

import type { ReactNode } from "react";
import { ClassroomDemo } from "./ClassroomDemo";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { BTN, GetStartedButton } from "./GetStarted";
import { pick, useLang } from "../lib/i18n";

const MASK = "radial-gradient(120% 90% at 50% 0%, black 15%, rgba(0,0,0,0.45) 55%, transparent 100%)";

export function TextureOverlay({ kind, className = "" }: { kind: "grid" | "dots" | "board"; className?: string }) {
  const cls = kind === "grid" ? "texture-grid" : kind === "dots" ? "texture-dots" : "texture-grid-board";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${kind === "board" ? "" : "-z-10"} ${cls} ${className}`}
      style={kind === "board" ? undefined : { maskImage: MASK, WebkitMaskImage: MASK }}
    />
  );
}

export function SectionHead({
  badge,
  badgeClass,
  badgeIcon,
  title,
  sub,
  id,
}: {
  badge?: string;
  badgeClass?: string;
  badgeIcon?: ReactNode;
  title: ReactNode;
  sub: string;
  id: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-2.5 text-center">
      {badge ? (
        <Reveal>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${badgeClass}`}>
            {badgeIcon}
            {badge}
          </span>
        </Reveal>
      ) : null}
      <Reveal delay={60}>
        <h2 id={id} className="text-[clamp(1.45rem,3.4vw,2.2rem)] leading-[1.2] text-ink">
          {title}
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{sub}</p>
      </Reveal>
    </div>
  );
}

function UnderlineWord({ children, underlineClass }: { children: ReactNode; underlineClass: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="relative inline-block text-brand-600">
        {children}
        <svg aria-hidden="true" viewBox="0 0 200 18" preserveAspectRatio="none" className={`absolute -bottom-1 left-0 h-[0.45em] w-full ${underlineClass}`} fill="none">
          <path d="M3 12.5C32 6.5 76 4 112 5.5c30 1.2 58 4.4 85 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
          <path d="M10 16c38-4.5 84-6 128-4.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        </svg>
      </span>
    </span>
  );
}

export function Hero() {
  const { lang } = useLang();
  const chips = lang === "bn"
    ? ["কণ্ঠে পড়ান AI শিক্ষক", "বন্ধুদের সাথে লাইভ ক্লাস", "বাংলা, English বা Banglish-এ উত্তর"]
    : ["AI teacher who teaches out loud", "Live class with friends", "Answer in Bangla, English or Banglish"];
  const stats = lang === "bn"
    ? [
        { value: "৩৩টি", label: "টপিক, অধ্যায় ধরে সাজানো" },
        { value: "২ জন", label: "AI শিক্ষক, নিজস্ব কণ্ঠে" },
        { value: "৪ জন", label: "পর্যন্ত সহপাঠী এক ক্লাসে" },
      ]
    : [
        { value: "33", label: "Topics, organised by chapter" },
        { value: "2", label: "AI teachers, in their own voice" },
        { value: "4", label: "Classmates in one live class" },
      ];

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pt-12 pb-10 sm:px-6 sm:pt-16 lg:pt-20 lg:pb-14">
      <TextureOverlay kind="grid" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -left-24 -z-10 size-[28rem] rounded-full opacity-25" style={{ background: "radial-gradient(closest-side, var(--color-brand-300), transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute top-16 -right-32 -z-10 size-[24rem] rounded-full opacity-20" style={{ background: "radial-gradient(closest-side, var(--color-marigold), transparent)" }} />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-10 xl:gap-14">
        <div className="flex flex-col items-start">
          <Reveal>
            <h1 id="hero-title" className="text-[clamp(1.85rem,5.4vw,3.2rem)] leading-[1.12] font-bold text-ink">
              {lang === "bn" ? (
                <>মুখস্থ নয়, <UnderlineWord underlineClass="text-marigold">বুঝে</UnderlineWord> শেখো — বুঝলে <UnderlineWord underlineClass="text-ember">আলো জ্বলে</UnderlineWord>।</>
              ) : (
                <>Don&apos;t memorise — <UnderlineWord underlineClass="text-marigold">understand</UnderlineWord>. When you understand, the <UnderlineWord underlineClass="text-ember">light turns on</UnderlineWord>.</>
              )}
            </h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
              {pick(lang, "Your own AI teacher for every subject, Class 6 to 10. Every chapter from your book, explained your way — until it truly clicks.", "ষষ্ঠ থেকে দশম শ্রেণির সব বিষয়ের জন্য তোমার নিজের AI শিক্ষক। বইয়ের প্রতিটি অধ্যায়, তোমার মতো করে বোঝানো — যতক্ষণ না মাথায় আলো জ্বলে।")}
            </p>
          </Reveal>
          <Reveal delay={210} className="w-full">
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <GetStartedButton className="h-11 w-full border-2 border-ink bg-flame px-5 text-[0.95rem] text-night shadow-hard hover:-translate-x-px hover:-translate-y-px hover:bg-[#ffbe45] hover:shadow-hard-lg active:translate-x-px active:translate-y-px active:bg-ember active:shadow-hard-sm sm:w-auto">
                {pick(lang, "Get Started Free", "বিনামূল্যে শুরু করো")}
              </GetStartedButton>
              <a
                className={`${BTN} h-11 w-full border-2 border-ink bg-paper px-5 text-[0.95rem] text-ink shadow-hard-sm hover:-translate-y-px hover:bg-white hover:shadow-hard active:translate-y-0.5 active:shadow-none sm:w-auto`}
                href="#preview"
              >
                <Icon name="play" className="size-4" />
                {pick(lang, "See AI Teacher", "AI শিক্ষক দেখো")}
              </a>
            </div>
          </Reveal>
          <Reveal delay={270}>
            <p className="mt-2.5 flex items-center gap-2 text-[0.8rem] text-ink-muted">
              <Icon name="check" className="size-4 text-brand-500" strokeWidth={2.4} />
              {pick(lang, "No login needed • No card required • Start in one minute", "লগইন লাগবে না • কোনো কার্ড লাগবে না • এক মিনিটেই শুরু")}
            </p>
          </Reveal>
          <Reveal delay={330} className="w-full">
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li key={chip} className="inline-flex items-center gap-1.5 rounded-full border border-paper-edge bg-white/70 px-2.5 py-1 text-[0.76rem] font-medium text-ink-soft">
                  <Icon name="check" className="size-3.5 text-brand-500" strokeWidth={2.6} />
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={390} className="w-full">
            <dl className="mt-4 grid w-full max-w-lg grid-cols-3 divide-x divide-paper-edge border-y border-paper-edge">
              {stats.map((stat) => (
                <div key={stat.label} className="px-3 py-2.5 first:pl-0">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-lg font-bold text-ink sm:text-xl">{stat.value}</span>
                    <span className="mt-0.5 block text-[0.7rem] leading-tight text-ink-muted sm:text-xs">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <Reveal from="scale" delay={200} className="relative">
          <div aria-hidden="true" className="absolute -inset-x-3 -top-4 bottom-8 -rotate-2 rounded-[2rem] border-2 border-paper-edge bg-paper-deep/70" />
          <ClassroomDemo />
          <div aria-hidden="true" className="animate-float absolute -top-4 -left-3 hidden rounded-2xl border-2 border-ink bg-marigold px-3 py-2 shadow-hard-sm lg:block" style={{ "--tilt": "-5deg" } as React.CSSProperties}>
            <p className="font-mono text-xs font-bold text-ink">{lang === "bn" ? "x = ৯" : "x = 9"}</p>
          </div>
          <div aria-hidden="true" className="animate-float absolute -right-3 -bottom-9 hidden rounded-2xl border-2 border-ink bg-white px-3.5 py-2.5 shadow-hard-sm lg:block" style={{ "--tilt": "4deg", animationDelay: "1.4s" } as React.CSSProperties}>
            <p className="flex items-center gap-1.5 text-[0.76rem] font-semibold text-ink">
              <Icon name="heart" className="size-3.5 text-coral" strokeWidth={2.2} />
              {pick(lang, "I got it!", "বুঝে গেছি!")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
