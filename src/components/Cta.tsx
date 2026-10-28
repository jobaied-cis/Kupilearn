"use client";

import { Icon } from "./Icon";
import { TextureOverlay } from "./Hero";
import { Reveal } from "./Reveal";
import { Logo } from "./Logo";
import { roleClick, useRoleDialog } from "./RoleDialog";

const APP = "https://classroom-impactx.vercel.app";
const BTN =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-55";

export function FinalCta() {
  const { open } = useRoleDialog();
  return (
    <section id="final-cta" aria-labelledby="cta-title" className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal from="scale">
          <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-brand-900 px-5 py-8 text-center shadow-hard-lg sm:px-10 sm:py-10">
            <TextureOverlay kind="board" className="opacity-80" />
            <div aria-hidden="true" className="pointer-events-none absolute -top-28 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full opacity-25" style={{ background: "radial-gradient(closest-side, var(--color-brand-400), transparent)" }} />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 -z-10 size-[22rem] rounded-full opacity-20" style={{ background: "radial-gradient(closest-side, var(--color-marigold), transparent)" }} />
            <div className="relative mx-auto max-w-2xl">
              <h2 id="cta-title" className="relative inline-block px-6 py-3 text-[clamp(1.45rem,3.6vw,2.2rem)] leading-[1.18] text-paper sm:px-8 sm:py-4">
                আজকের অধ্যায়টা একসাথে বুঝি?
                <svg aria-hidden="true" viewBox="0 0 220 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-marigold/50" fill="none">
                  <path d="M112 6C63 4 14 16 9 39c-5 22 44 36 101 35 50-1 100-14 101-35C212 18 161 8 112 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                </svg>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100/75 sm:text-base">
                আজ রাতের হোমওয়ার্ক দিয়েই শুরু করে দেখো। কার্ড লাগবে না, ইনস্টল করতে হবে না — একটা অধ্যায় বেছে নিলেই AI শিক্ষক পড়াতে শুরু করবে।
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <a
                  className={`${BTN} h-11 w-full border-2 border-flame/60 bg-flame px-5 text-[0.95rem] text-night hover:bg-[#ffbe45] hover:shadow-[0_6px_24px_-6px_rgba(255,176,32,0.55)] active:translate-y-px active:bg-ember sm:w-auto`}
                  href={`${APP}/signup`}
                >
                  বিনামূল্যে শুরু করো
                  <Icon name="arrow" className="size-5 transition-transform duration-300 group-hover/btn:translate-x-1" strokeWidth={2} />
                </a>
                <a
                  className={`${BTN} h-11 w-full border-2 border-transparent px-5 text-[0.95rem] text-brand-100 hover:bg-paper/10 hover:text-paper sm:w-auto`}
                  aria-haspopup="dialog"
                  href={`${APP}/login`}
                  onClick={roleClick(open, "login")}
                >
                  আগে থেকেই অ্যাকাউন্ট আছে?
                </a>
              </div>
              <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {["কোনো কার্ড লাগবে না", "বন্ধুদের সাথে লাইভ ক্লাস", "মোবাইলেই চলে"].map((item) => (
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

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "প্রোডাক্ট",
    links: [
      { label: "ফিচারসমূহ", href: "#features" },
      { label: "কীভাবে কাজ করে", href: "#how-it-works" },
      { label: "AI শিক্ষক প্রিভিউ", href: "#preview" },
    ],
  },
  {
    title: "শিখুন",
    links: [
      { label: "বিষয় ও অধ্যায়", href: "#topics" },
      { label: "অভিভাবকদের জন্য", href: "#parents" },
      { label: "শেখা শুরু করো", href: `${APP}/signup` },
    ],
  },
  {
    title: "অ্যাকাউন্ট",
    links: [
      { label: "অ্যাকাউন্ট খোলো", href: `${APP}/signup` },
      { label: "লগইন", href: `${APP}/login` },
      { label: "আমার ক্লাস", href: `${APP}/dashboard` },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t-2 border-ink bg-board px-5 pt-16 pb-10 text-brand-100/70 sm:px-8">
      <TextureOverlay kind="board" className="opacity-60" />
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
          <div>
            <Logo dark />
            <p className="mt-5 max-w-xs text-[0.92rem] leading-relaxed text-brand-100/60">
              বুঝলে আলো জ্বলে। ষষ্ঠ থেকে দশম শ্রেণির সব বিষয়ের AI শিক্ষক — বাংলায়, তোমার মতো করে বোঝানো, যতক্ষণ না বোঝা হয়।
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-board-line bg-board-soft/70 px-3 py-1.5 text-[0.78rem] text-brand-200/70">
              <Icon name="cap" className="size-4 text-brand-300" strokeWidth={1.8} />
              জাতীয় পাঠ্যক্রম অনুসারে
            </p>
          </div>
          <nav aria-label="ফুটার মেনু" className="grid gap-8 sm:grid-cols-3">
            {FOOTER_COLS.map((col) => (
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
          <p className="numerals-bn text-center text-[0.78rem] text-brand-200/45 sm:text-left">© ২০২৬ কুপি (Kupi)। সর্বস্বত্ব সংরক্ষিত।</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <li><a className="text-[0.78rem] text-brand-200/50 transition-colors hover:text-brand-200" href={`${APP}/privacy`}>গোপনীয়তা নীতি</a></li>
            <li><a className="text-[0.78rem] text-brand-200/50 transition-colors hover:text-brand-200" href={`${APP}/terms`}>ব্যবহারের শর্তাবলি</a></li>
            <li><a className="text-[0.78rem] text-brand-200/50 transition-colors hover:text-brand-200" href={`${APP}/privacy#children`}>শিশু-সুরক্ষা নীতি</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
