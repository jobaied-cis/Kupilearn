"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { BTN, BTN_FLAME, GetStartedButton } from "./GetStarted";
import { LanguageToggle, pick, useLang } from "../lib/i18n";

export function Navbar() {
  const { lang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const LINKS = [
    { href: "#features", label: pick(lang, "Features", "ফিচার") },
    { href: "#how-it-works", label: pick(lang, "How it works", "কীভাবে কাজ করে") },
    { href: "#preview", label: pick(lang, "AI Teacher", "AI শিক্ষক") },
    { href: "#topics", label: pick(lang, "Chapters", "অধ্যায়সমূহ") },
    { href: "#parents", label: pick(lang, "For Parents", "অভিভাবকদের জন্য") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled ? "border-paper-edge bg-paper/97 shadow-[0_1px_20px_-12px_rgba(22,22,58,0.35)]" : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label={pick(lang, "Main menu", "প্রধান মেনু")} className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-5 px-4 sm:h-20 sm:px-6">
        <Logo />
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a className="group relative rounded-full px-3.5 py-2 text-[0.92rem] font-medium text-ink-soft transition-colors hover:text-ink" href={link.href}>
                <span className="relative">
                  {link.label}
                  <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-marigold transition-[width] duration-300 ease-[var(--ease-out-expo)] group-hover:w-full" />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle />
          <GetStartedButton className={`${BTN_FLAME} h-9 px-4 text-sm`}>
            {pick(lang, "Get Started Free", "বিনামূল্যে শুরু করো")}
          </GetStartedButton>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageToggle />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-xl border-2 border-ink bg-paper text-ink shadow-hard-sm transition-transform active:translate-y-0.5 active:shadow-none"
          >
            <Icon name={menuOpen ? "close" : "menu"} className="size-5" strokeWidth={2} />
            <span className="sr-only">{menuOpen ? pick(lang, "Close menu", "মেনু বন্ধ করো") : pick(lang, "Open menu", "মেনু খোলো")}</span>
          </button>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!menuOpen} className="border-t border-paper-edge bg-paper lg:hidden">
        <ul className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
          {LINKS.map((link, i) => (
            <li key={link.href}>
              <a className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-medium text-ink transition-colors hover:bg-ink/[0.05]" href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
                <span className="font-mono text-xs text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
              </a>
            </li>
          ))}
          <li className="mt-3">
            <GetStartedButton className={`${BTN_FLAME} h-11 w-full px-5 text-[0.95rem]`}>
              {pick(lang, "Get Started Free", "বিনামূল্যে শুরু করো")}
            </GetStartedButton>
          </li>
        </ul>
      </div>
    </header>
  );
}

export { BTN, BTN_FLAME };
export { BTN_PAPER } from "./GetStarted";
