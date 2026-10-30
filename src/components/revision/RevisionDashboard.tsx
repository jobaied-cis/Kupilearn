"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { pick, useLang } from "../../lib/i18n";
import { revisionFetch } from "../../lib/revision/client";
import type { RevisionOverview } from "../../lib/revision/service";

const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const BTN = "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-flame px-4 py-2 text-sm font-bold text-night shadow-hard-sm transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none disabled:opacity-60";

function Empty({ en, bn }: { en: string; bn: string }) {
  const { lang } = useLang();
  return <p className="rounded-xl bg-paper px-3 py-3 text-sm text-ink-soft">{pick(lang, en, bn)}</p>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${CARD} p-4`}>
      <h2 id={id} className="text-[1.05rem] text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const pct = (score: number) => `${Math.round(score * 100)}%`;

export function RevisionDashboard() {
  const { lang } = useLang();
  const [data, setData] = useState<RevisionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await revisionFetch<RevisionOverview>("/api/revision/overview"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "FAILED");
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(id);
  }, [load]);

  async function startDaily() {
    setBusy(true);
    try {
      await revisionFetch("/api/revision/sessions", { method: "POST", body: JSON.stringify({ sessionType: "daily" }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className={`mx-auto max-w-xl ${CARD} p-6 text-center`} role="alert">
        <h1 className="text-xl text-ink">{pick(lang, "Revision could not load", "রিভিশন লোড করা যায়নি")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, "Please try again. Your lessons are not affected.", "আবার চেষ্টা করো। তোমার লেসনে কোনো সমস্যা হয়নি।")}</p>
        <button type="button" className={`${BTN} mt-4`} onClick={() => void load()}>{pick(lang, "Try again", "আবার চেষ্টা করো")}</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-[84rem]" role="status" aria-label={pick(lang, "Loading revision", "রিভিশন লোড হচ্ছে")}>
        <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-ink/10" />
        <div className="h-64 animate-pulse rounded-2xl border-2 border-ink/10 bg-white" />
      </div>
    );
  }

  const m = data.metrics;
  const hasData = m.totalAttempts > 0;

  return (
    <div className="mx-auto flex max-w-[84rem] flex-col gap-4">
      <div>
        <h1 className="text-[clamp(1.35rem,3vw,1.8rem)] leading-tight text-ink">{pick(lang, "Revision", "রিভিশন")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{pick(lang, "Little and often - revise what you learned before it fades.", "অল্প অল্প করে - ভুলে যাওয়ার আগেই শেখা জিনিস ঝালিয়ে নাও।")}</p>
      </div>

      {/* Revision overview + mastery summary */}
      <Section id="rev-overview" title={pick(lang, "Mastery summary", "আয়ত্তের সারাংশ")}>
        {!hasData ? (
          <Empty en="Nothing to revise yet. Finish a lesson or answer practice questions and your concepts will appear here." bn="এখনো রিভিশনের কিছু নেই। একটি লেসন শেষ করো বা অনুশীলন প্রশ্নের উত্তর দাও - তোমার টপিকগুলো এখানে আসবে।" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [pick(lang, "Concepts started", "শুরু করা টপিক"), String(m.conceptsStarted)],
                [pick(lang, "Mastered", "আয়ত্ত হয়েছে"), String(m.conceptsMastered)],
                [pick(lang, "Accuracy", "সঠিক উত্তরের হার"), m.accuracy === null ? "-" : pct(m.accuracy)],
                [pick(lang, "Due now", "এখন বাকি"), String(m.dueNow)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-paper px-3 py-2">
                  <dt className="text-[0.75rem] font-semibold text-ink-muted">{label}</dt>
                  <dd className="font-display text-xl font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 flex flex-col gap-2">
              {data.mastery.map((row) => (
                <li key={row.conceptId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-paper-edge px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{lang === "bn" ? (row.concept?.nameBn ?? row.conceptId) : (row.concept?.name ?? row.conceptId)}</span>
                  <span className="text-xs text-ink-muted">{row.correctAttempts}/{row.totalAttempts} {pick(lang, "correct", "সঠিক")}</span>
                  <span className="text-sm font-bold text-ink">{pct(row.masteryScore)}</span>
                  <span className="rounded-full bg-lagoon-soft px-2 py-0.5 text-[0.7rem] font-bold text-padma-ink">{row.masteryStatus.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily revision */}
        <Section id="rev-daily" title={pick(lang, "Daily revision", "প্রতিদিনের রিভিশন")}>
          {data.dueToday.length === 0 ? (
            <Empty en="No revision is due today. New due items appear here after you learn a concept." bn="আজ কোনো রিভিশন বাকি নেই। নতুন টপিক শিখলে এখানে আসবে।" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.dueToday.map((s) => (
                <li key={s.id} className="rounded-xl bg-marigold-soft px-3 py-2 text-sm font-semibold text-ink">{lang === "bn" ? (s.concept?.nameBn ?? s.conceptId) : (s.concept?.name ?? s.conceptId)}</li>
              ))}
            </ul>
          )}
          <button type="button" className={`${BTN} mt-3`} disabled={busy} onClick={() => void startDaily()}>
            <Icon name="refresh" className="size-4" strokeWidth={2} />{pick(lang, "Start a revision session", "রিভিশন সেশন শুরু করো")}
          </button>
        </Section>

        {/* Weak concepts */}
        <Section id="rev-weak" title={pick(lang, "Weak concepts", "দুর্বল টপিক")}>
          {data.weakConcepts.length === 0 ? (
            <Empty en="No weak concepts yet. Keep learning - this is where topics that need another look will show up." bn="এখনো কোনো দুর্বল টপিক নেই। শিখতে থাকো - যেসব টপিকে আবার নজর লাগবে সেগুলো এখানে আসবে।" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.weakConcepts.map((row) => (
                <li key={row.conceptId} className="flex items-center justify-between gap-2 rounded-xl bg-coral-soft px-3 py-2">
                  <span className="text-sm font-semibold text-ink">{lang === "bn" ? (row.concept?.nameBn ?? row.conceptId) : (row.concept?.name ?? row.conceptId)}</span>
                  <span className="text-sm font-bold text-shapla-ink">{pct(row.masteryScore)}</span>
                  {row.reasons?.length ? <span className="w-full text-xs text-ink-soft">{row.reasons.join(" ")}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Upcoming revisions */}
        <Section id="rev-upcoming" title={pick(lang, "Upcoming revisions", "সামনের রিভিশন")}>
          {data.upcoming.length === 0 ? (
            <Empty en="No upcoming revisions scheduled yet." bn="এখনো কোনো রিভিশনের সময় ঠিক হয়নি।" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.upcoming.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-paper-edge px-3 py-2">
                  <span className="text-sm font-semibold text-ink">{lang === "bn" ? (s.concept?.nameBn ?? s.conceptId) : (s.concept?.name ?? s.conceptId)}</span>
                  <span className="text-xs font-semibold text-ink-muted">
                    <Icon name="clock" className="mr-1 inline size-3.5" strokeWidth={2} />
                    {s.due ? `${pick(lang, "Due now", "এখনই বাকি")} · ` : ""}{new Date(s.scheduledAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")} · {s.priority} · {s.reviewIntervalDays}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Revision history */}
        <Section id="rev-history" title={pick(lang, "Revision history", "রিভিশনের ইতিহাস")}>
          {data.recentSessions.length === 0 && data.recentAttempts.length === 0 ? (
            <Empty en="No revision history yet. Completed sessions and answered questions will be listed here." bn="এখনো কোনো ইতিহাস নেই। শেষ করা সেশন আর উত্তর দেওয়া প্রশ্ন এখানে আসবে।" />
          ) : (
            <ul className="flex flex-col gap-2 text-sm text-ink-soft">
              {data.recentSessions.map((s) => (
                <li key={s.sessionId} className="flex justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                  <span className="font-semibold text-ink">{s.sessionType.replace("_", " ")}</span>
                  <span>{s.correctAnswers}/{s.totalQuestions} · {s.completedAt ? pick(lang, "completed", "শেষ") : pick(lang, "in progress", "চলছে")}</span>
                </li>
              ))}
              {data.recentAttempts.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                  <span className="truncate font-semibold text-ink">{a.conceptId}</span>
                  <span className={a.isCorrect ? "font-bold text-kolapata" : "font-bold text-shapla-ink"}>{a.isCorrect ? pick(lang, "correct", "সঠিক") : pick(lang, "wrong", "ভুল")}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm"><Link href="/dashboard/lesson" className="font-bold text-brand-700 underline decoration-flame decoration-2 underline-offset-4">{pick(lang, "Go to lessons", "লেসনে যাও")}</Link></p>
        </Section>
      </div>
    </div>
  );
}