"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bn";

const KEY = "kupi-lang";
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; toggle: () => void }>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
});

export const useLang = () => useContext(Ctx);

/** Pick the string for the active language. English is the default. */
export function pick(lang: Lang, en: string, bn: string) {
  return lang === "bn" ? bn : en;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "bn" || saved === "en") {
        setLangState(saved);
        document.documentElement.lang = saved === "bn" ? "bn" : "en";
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(KEY, l);
    document.documentElement.lang = l === "bn" ? "bn" : "en";
  }, []);

  const toggle = useCallback(() => setLang(lang === "en" ? "bn" : "en"), [lang, setLang]);

  return <Ctx.Provider value={{ lang, setLang, toggle }}>{children}</Ctx.Provider>;
}

export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  const base = "h-8 min-w-10 rounded-full px-2.5 text-[0.82rem] font-bold transition-colors";
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border-2 p-0.5 ${dark ? "border-paper/25" : "border-ink/15 bg-white/70"}`}
      role="group"
      aria-label="Language"
    >
      <button type="button" onClick={() => setLang("en")} aria-pressed={lang === "en"} className={`${base} ${lang === "en" ? "bg-night text-flame" : dark ? "text-paper/70 hover:text-paper" : "text-ink-soft hover:text-ink"}`}>
        EN
      </button>
      <button type="button" onClick={() => setLang("bn")} aria-pressed={lang === "bn"} className={`${base} ${lang === "bn" ? "bg-night text-flame" : dark ? "text-paper/70 hover:text-paper" : "text-ink-soft hover:text-ink"}`}>
        বাংলা
      </button>
    </div>
  );
}
