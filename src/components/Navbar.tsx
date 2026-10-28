"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { roleClick, useRoleDialog } from "./RoleDialog";

const APP = "https://classroom-impactx.vercel.app";

const LINKS = [
  { href: "#features", label: "ফিচার" },
  { href: "#how-it-works", label: "কীভাবে কাজ করে" },
  { href: "#preview", label: "AI শিক্ষক" },
  { href: "#topics", label: "অধ্যায়সমূহ" },
  { href: "#parents", label: "অভিভাবকদের জন্য" },
];

const NUMERALS = ["০১", "০২", "০৩", "০৪", "০৫"];

const BTN =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-55";
const BTN_FLAME =
  "bg-flame text-night border-2 border-ink shadow-hard hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg hover:bg-[#ffbe45] active:translate-x-px active:translate-y-px active:shadow-hard-sm active:bg-ember";
const BTN_PAPER =
  "bg-paper text-ink border-2 border-ink shadow-hard-sm hover:-translate-y-px hover:shadow-hard hover:bg-white active:translate-y-0.5 active:shadow-none";

export function Navbar() {
  const { open } = useRoleDialog();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setMenuOpen(false);
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
        scrolled
          ? "border-paper-edge bg-paper/97 shadow-[0_1px_20px_-12px_rgba(22,22,58,0.35)]"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label="প্রধান মেনু" className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-5 px-4 sm:h-20 sm:px-6">
        <Logo />
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a className="group relative rounded-full px-3.5 py-2 text-[0.92rem] font-medium text-ink-soft transition-colors hover:text-ink" href={link.href}>
                <span className="relative">
                  {link.label}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-marigold transition-[width] duration-300 ease-[var(--ease-out-expo)] group-hover:w-full"
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <a
            className={`${BTN} h-9 border-2 border-transparent px-4 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink`}
            data-guide="nav-login"
            aria-haspopup="dialog"
            href={`${APP}/login`}
            onClick={roleClick(open, "login")}
          >
            লগইন
          </a>
          <a
            className={`${BTN} ${BTN_FLAME} h-9 px-4 text-sm`}
            data-guide="nav-signup"
            aria-haspopup="dialog"
            href={`${APP}/signup`}
            onClick={roleClick(open, "signup")}
          >
            বিনামূল্যে শুরু করো
            <Icon name="arrow" className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" strokeWidth={2} />
          </a>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <a
            className={`${BTN} ${BTN_FLAME} h-9 px-4 text-sm`}
            data-guide="nav-login"
            aria-haspopup="dialog"
            href={`${APP}/login`}
            onClick={roleClick(open, "login")}
          >
            লগইন
          </a>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            data-guide="nav-menu"
            onClick={() => setMenuOpen((value) => !value)}
            className="grid size-9 place-items-center rounded-xl border-2 border-ink bg-paper text-ink shadow-hard-sm transition-transform active:translate-y-0.5 active:shadow-none"
          >
            <Icon name={menuOpen ? "close" : "menu"} className="size-5" strokeWidth={2} />
            <span className="sr-only">{menuOpen ? "মেনু বন্ধ করো" : "মেনু খোলো"}</span>
          </button>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!menuOpen} className="border-t border-paper-edge bg-paper lg:hidden">
        <ul className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
          {LINKS.map((link, i) => (
            <li key={link.href}>
              <a
                className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-medium text-ink transition-colors hover:bg-ink/[0.05]"
                href={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
                <span className="numerals-bn font-mono text-xs text-ink-muted">{NUMERALS[i]}</span>
              </a>
            </li>
          ))}
          <li className="mt-3 flex flex-col gap-2.5">
            <a
              className={`${BTN} ${BTN_FLAME} h-11 px-5 text-[0.95rem]`}
              data-guide="nav-signup"
              aria-haspopup="dialog"
              href={`${APP}/signup`}
              onClick={roleClick(open, "signup")}
            >
              বিনামূল্যে শুরু করো
            </a>
            <a
              className={`${BTN} ${BTN_PAPER} h-11 px-5 text-[0.95rem]`}
              data-guide="nav-login"
              aria-haspopup="dialog"
              href={`${APP}/login`}
              onClick={roleClick(open, "login")}
            >
              লগইন
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}

export { BTN, BTN_FLAME, BTN_PAPER };
