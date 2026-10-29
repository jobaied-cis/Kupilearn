"use client";

import { Icon } from "./Icon";
import { TextureOverlay } from "./Hero";
import { Reveal } from "./Reveal";
import { Logo } from "./Logo";
import { GetStartedButton } from "./GetStarted";
import { pick, useLang } from "../lib/i18n";

export function FinalCta() {
  const { lang } = useLang();
  return (
    <section id="final-cta" aria-labelledby="cta-title" className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal from="scale">
          <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-brand-900 px-5 py-8 text-center shadow-hard-lg sm:px-10 sm:py-10">
            <TextureOverlay kind="board" className="opacity-80" />
            <div className="relative mx-auto max-w-2xl">
              <h2 id="cta-title" className="text-[clamp(1.45rem,3.6vw,2.2rem)] leading-[1.18] text-paper">
                {pick(lang, "Shall we understand today's chapter together?", "আজকের অধ্যায়টা একসাথে বুঝি?")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100/75 sm:text-base">
                {pick(lang, "Start with tonight's homework. No card, no install, no login — pick a chapter and your AI teacher starts teaching.", "আজ রাতের হোমওয়ার্ক দিয়েই শুরু করে দেখো। কার্ড লাগবে না, লগইন লাগবে না — একটা অধ্যায় বেছে নিলেই AI শিক্ষক পড়াতে শুরু করবে।")}
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <GetStartedButton className="h-11 w-full border-2 border-flame/60 bg-flame px-5 text-[0.95rem] text-night hover:bg-[#ffbe45] active:translate-y-px active:bg-ember sm:w-auto">
                  {pick(lang, "Get Started Free", "বিনামূল্যে শুরু করো")}
                </GetStartedButton>
              </div>
              <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {(lang === "bn" ? ["কোনো কার্ড লাগবে না", "লগইন লাগবে না", "মোবাইলেই চলে"] : ["No card required", "No login needed", "Works on mobile"]).map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-[0.82rem] text-brand-200/75">
                    <Icon name="check" className="size-3.5 text-brand-300" strokeWidth={2.8} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  const { lang } = useLang();
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: pick(lang, "Product", "প্রোডাক্ট"),
      links: [
        { label: pick(lang, "Features", "ফিচারসমূহ"), href: "#features" },
        { label: pick(lang, "How it works", "কীভাবে কাজ করে"), href: "#how-it-works" },
        { label: pick(lang, "AI Teacher preview", "AI শিক্ষক প্রিভিউ"), href: "#preview" },
      ],
    },
    {
      title: pick(lang, "Learn", "শিখুন"),
      links: [
        { label: pick(lang, "Subjects & chapters", "বিষয় ও অধ্যায়"), href: "#topics" },
        { label: pick(lang, "For parents", "অভিভাবকদের জন্য"), href: "#parents" },
        { label: pick(lang, "My dashboard", "আমার ড্যাশবোর্ড"), href: "/dashboard" },
      ],
    },
    {
      title: pick(lang, "Start", "শুরু"),
      links: [
        { label: pick(lang, "Get Started Free", "বিনামূল্যে শুরু করো"), href: "/onboarding" },
        { label: pick(lang, "Dashboard", "ড্যাশবোর্ড"), href: "/dashboard" },
      ],
    },
  ];
  return (
    <footer className="relative overflow-hidden border-t-2 border-ink bg-board px-5 pt-16 pb-10 text-brand-100/70 sm:px-8">
      <TextureOverlay kind="board" className="opacity-60" />
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <div>
            <Logo dark />
            <p className="mt-5 max-w-xs text-[0.92rem] leading-relaxed text-brand-100/60">
              {pick(lang, "When you understand, the light turns on. Your AI teacher for every subject — explained your way, until it clicks.", "বুঝলে আলো জ্বলে। সব বিষয়ের AI শিক্ষক — তোমার মতো করে বোঝানো, যতক্ষণ না বোঝা হয়।")}
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-board-line bg-board-soft/70 px-3 py-1.5 text-[0.78rem] text-brand-200/70">
              <Icon name="cap" className="size-4 text-brand-300" strokeWidth={1.8} />
              {pick(lang, "Follows the national curriculum", "জাতীয় পাঠ্যক্রম অনুসারে")}
            </p>
          </div>
          <nav aria-label={pick(lang, "Footer menu", "ফুটার মেনু")} className="grid gap-8 sm:grid-cols-3">
            {cols.map((col) => (
              <div key={col.title}>
                <h2 className="font-display text-[0.82rem] font-semibold tracking-wide text-paper uppercase">{col.title}</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a className="group inline-flex items-center gap-1.5 text-[0.9rem] text-brand-100/60 transition-colors hover:text-brand-200" href={link.href}>
                        {link.label}
                        <Icon name="arrow" className="size-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" strokeWidth={2.4} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-col-reverse items-center justify-between gap-5 border-t border-board-line pt-7 sm:flex-row">
          <p className="text-center text-[0.78rem] text-brand-200/45 sm:text-left">© 2026 Kupi. {pick(lang, "All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।")}</p>
          <p className="text-[0.78rem] text-brand-200/50">{pick(lang, "No login. No ads. Just learning.", "লগইন নেই। বিজ্ঞাপন নেই। শুধু শেখা।")}</p>
        </div>
      </div>
    </footer>
  );
}
