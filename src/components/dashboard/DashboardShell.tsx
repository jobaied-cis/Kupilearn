"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "../Icon";
import { Logo } from "../Logo";
import { LanguageToggle, pick, useLang } from "../../lib/i18n";
import { clearProfile, getProfile, type Profile } from "../../lib/profile";

export type DashSection = "home" | "classroom" | "lesson" | "revision" | "practice" | "homework" | "games" | "subjects" | "progress" | "profile" | "subscription" | "learn" | "offline" | "help";

const PRIMARY: { id: DashSection; icon: IconName; en: string; bn: string; href: string }[] = [
  { id: "home", icon: "home", en: "Home", bn: "হোম", href: "/dashboard" },
  { id: "lesson", icon: "book", en: "Lesson", bn: "লেসন", href: "/dashboard/lesson" },
  { id: "revision", icon: "refresh", en: "Revision", bn: "রিভিশন", href: "/dashboard/revision" },
  { id: "practice", icon: "target", en: "Practice", bn: "অনুশীলন", href: "/dashboard/practice" },
  { id: "homework", icon: "notes", en: "Homework", bn: "হোমওয়ার্ক", href: "/dashboard/homework" },
  { id: "games", icon: "game", en: "Games", bn: "গেমস", href: "/dashboard/games" },
];

const MORE: typeof PRIMARY = [
  { id: "subjects", icon: "board", en: "Subjects", bn: "বিষয়সমূহ", href: "/dashboard/subjects" },
  { id: "progress", icon: "chart", en: "Progress", bn: "অগ্রগতি", href: "/dashboard/progress" },
  { id: "profile", icon: "user", en: "Profile", bn: "প্রোফাইল", href: "/dashboard/profile" },
  { id: "subscription", icon: "crown", en: "Subscription", bn: "সাবস্ক্রিপশন", href: "/dashboard/subscription" },
  { id: "learn", icon: "lightbulb", en: "Learn Anything", bn: "যেকোনো প্রশ্ন নিয়ে শেখো", href: "/dashboard/learn" },
  { id: "offline", icon: "download", en: "Download & Offline", bn: "ডাউনলোড ও অফলাইন", href: "/dashboard/offline" },
  { id: "help", icon: "help", en: "Help & Report", bn: "সাহায্য ও রিপোর্ট", href: "/dashboard/help" },
];

function sectionFromPath(path: string): DashSection {
  const seg = path.split("/")[2];
  // The AI Classroom now lives inside Lessons, so its old URL highlights Lesson.
  if (seg === "classroom") return "lesson";
  const all = [...PRIMARY, ...MORE].find((i) => i.id === seg);
  return all ? all.id : "home";
}

function NavItems({ active, lang, onGo }: { active: DashSection; lang: "en" | "bn"; onGo?: () => void }) {
  const render = (item: (typeof PRIMARY)[number]) => {
    const isActive = active === item.id;
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onGo}
        aria-current={isActive ? "page" : undefined}
        className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.92rem] font-semibold transition-colors ${isActive ? "bg-flame text-night" : "text-paper/75 hover:bg-paper/8 hover:text-paper"}`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${isActive ? "bg-night/10" : ""}`}>
          <Icon name={item.icon} className="size-[1.1rem]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1 truncate">{pick(lang, item.en, item.bn)}</span>
        {isActive ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-night" /> : null}
      </Link>
    );
  };
  return (
    <>
      <div className="relative mt-5 flex flex-col gap-0.5">{PRIMARY.map(render)}</div>
      <p className="relative mt-5 px-3 text-[0.68rem] font-bold tracking-widest text-paper/40 uppercase">{pick(lang, "More", "আরও")}</p>
      <div className="relative mt-1.5 flex flex-col gap-0.5">{MORE.map(render)}</div>
    </>
  );
}

function SidebarCard({ lang }: { lang: "en" | "bn" }) {
  return (
    <Link href="/dashboard/subscription" className="group relative mt-auto block overflow-hidden rounded-2xl border border-flame/30 bg-board-soft p-4 transition-colors hover:border-flame/70">
      <span aria-hidden="true" className="absolute -right-6 -bottom-8 size-24 rounded-full bg-flame/15 transition-transform duration-500 group-hover:scale-125" />
      <span className="relative flex items-center gap-2 text-[0.75rem] font-semibold tracking-wide text-flame">
        <Icon name="crown" className="size-4" strokeWidth={1.9} />
        {pick(lang, "Free Plan", "ফ্রি প্ল্যান")}
      </span>
      <span className="relative mt-1 block font-display text-[1rem] leading-snug font-bold text-paper">{pick(lang, "Premium coming soon", "প্রিমিয়াম শীঘ্রই আসছে")}</span>
      <span className="relative mt-0.5 flex items-center gap-1 text-[0.78rem] text-paper/70">
        {pick(lang, "See plans", "প্ল্যান দেখো")}
        <Icon name="arrow" className="size-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
      </span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Hydration: this shell is server-rendered as a shared static shell, so
  // the server highlight and the client's real URL can disagree. Render the
  // neutral "home" highlight on the server and first client render, then
  // sync the real section after mount (same pattern as the profile below).
  const [active, setActive] = useState<DashSection>("home");
  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(sectionFromPath(pathname ?? "/dashboard")));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = getProfile();
      if (!p) {
        router.replace("/onboarding");
        return;
      }
      setProfile(p);
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  // Instant navigation (Next 16): the page segment must always render.
  // The old early return dropped `children` until the local profile loaded,
  // so /dashboard/[section] was dropped from rendering. Render the shell and
  // children immediately, covered by a loading overlay until the profile
  // check finishes (or redirects to onboarding).
  const displayName = profile?.name ?? "Learner";
  const initial = displayName.trim().charAt(0).toUpperCase() || "K";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      {/* Sidebar — desktop, same dark night panel as kupi-dashboard.html */}
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <nav aria-label={pick(lang, "Dashboard menu", "ড্যাশবোর্ড মেনু")} className="relative flex h-full flex-col overflow-x-hidden overflow-y-auto bg-night px-3.5 pt-5 pb-4 text-paper">
          <div aria-hidden="true" className="texture-grid-board pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex h-11 items-center justify-between px-2">
            <Logo dark />
          </div>
          <NavItems active={active} lang={lang} />
          <div className="relative mt-4">
            <SidebarCard lang={lang} />
          </div>
          <button
            type="button"
            onClick={() => { clearProfile(); router.push("/"); }}
            className="relative mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.78rem] text-paper/60 transition-colors hover:bg-paper/5 hover:text-paper"
          >
            <Icon name="user" className="size-3.5 shrink-0" strokeWidth={1.9} />
            {pick(lang, "Reset & start fresh", "রিসেট করে নতুন করে শুরু")}
          </button>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 border-b-2 border-ink/10 bg-paper/97">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:gap-1 lg:px-6">
            <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-white shadow-hard-sm lg:hidden">
              <Icon name={menuOpen ? "close" : "menu"} className="size-5" strokeWidth={2} />
              <span className="sr-only">{pick(lang, "Menu", "মেনু")}</span>
            </button>
            <span className="lg:hidden"><Logo /></span>
            <nav aria-label={pick(lang, "Quick links", "দ্রুত লিংক")} className="hidden h-full items-stretch lg:flex">
              <Link href="/dashboard" className="group relative flex items-center gap-2 px-4 text-[0.95rem] font-semibold text-ink">{pick(lang, "Dashboard", "ড্যাশবোর্ড")}</Link>
              <Link href="/dashboard/progress" className="group relative flex items-center gap-2 px-4 text-[0.95rem] font-semibold text-ink-soft hover:text-ink">{pick(lang, "Learning Report", "লার্নিং রিপোর্ট")}</Link>
              <Link href="/dashboard/subjects" className="group relative flex items-center gap-2 px-4 text-[0.95rem] font-semibold text-ink-soft hover:text-ink">{pick(lang, "Explore", "এক্সপ্লোর")}</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <label className="hidden items-center gap-2 rounded-full border border-paper-edge bg-white px-3 py-1.5 md:flex">
                <Icon name="search" className="size-4 text-ink-muted" strokeWidth={2} />
                <span className="sr-only">{pick(lang, "Search", "খোঁজো")}</span>
                <input placeholder={pick(lang, "Search subject, chapter or game…", "বিষয়, অধ্যায় বা গেম খোঁজো…")} className="w-44 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted lg:w-56" />
              </label>
              <LanguageToggle />
              <Link href="/dashboard/profile" className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-0.5 pr-3 pl-0.5 shadow-hard-sm">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-flame font-display text-sm font-bold text-night">{initial}</span>
                <span className="max-w-24 truncate text-sm font-bold text-ink">{displayName}</span>
              </Link>
            </div>
          </div>
          {/* Mobile menu */}
          <div hidden={!menuOpen} className="border-t border-paper-edge bg-night px-3 py-3 lg:hidden">
            <NavItems active={active} lang={lang} onGo={() => setMenuOpen(false)} />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-3 pt-3 pb-10 sm:px-5 lg:px-6 lg:pt-4">
          {children}
        </main>
      </div>
      {!ready ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-paper px-4" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Icon name="flame" className="size-5 text-ember" strokeWidth={1.8} />
            {pick(lang, "Loading your dashboard\u2026", "\u09a4\u09cb\u09ae\u09be\u09b0 \u09a1\u09cd\u09af\u09be\u09b6\u09ac\u09cb\u09b0\u09cd\u09a1 \u09b2\u09cb\u09a1 \u09b9\u099a\u09cd\u099b\u09c7\u2026")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { PRIMARY, MORE };
