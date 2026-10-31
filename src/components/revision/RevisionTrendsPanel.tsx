"use client";

import { useCallback, useEffect, useState } from "react";
import { pick, useLang } from "../../lib/i18n";
import { revisionFetch } from "../../lib/revision/client";
import type { RevisionTrends } from "../../lib/revision/analytics";

const CARD = "rounded-2xl border-2 border-ink bg-white shadow-hard-sm";
const WINDOWS = [7, 30, 90] as const;

interface Props {
  /** conceptId -> display names, from the dashboard's mastery rows. */
  conceptLabels: Record<string, { en: string; bn: string }>;
}

/**
 * Learning analytics & trends (Part 10). Read-only: fetches derived
 * trends and renders only numbers that trace to recorded attempts and
 * sessions. Empty/short history gets an honest empty state, never a
 * fabricated chart.
 */
export function RevisionTrendsPanel({ conceptLabels }: Props) {
  const { lang } = useLang();
  const [days, setDays] = useState<number>(30);
  const [trends, setTrends] = useState<RevisionTrends | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (windowDays: number) => {
    try {
      setFailed(false);
      const res = await revisionFetch<{ trends: RevisionTrends }>(`/api/revision/trends?days=${windowDays}`);
      setTrends(res.trends);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => void load(days));
    return () => cancelAnimationFrame(id);
  }, [days, load]);

  const label = (conceptId: string) => {
    const names = conceptLabels[conceptId];
    return names ? pick(lang, names.en, names.bn) : conceptId;
  };

  return (
    <section aria-labelledby="rev-trends" className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="rev-trends" className="text-[1.05rem] text-ink">{pick(lang, "Your progress", "তোমার অগ্রগতি")}</h2>
        <div className="flex gap-1" role="group" aria-label={pick(lang, "Time window", "সময়ের পরিসর")}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={days === w}
              onClick={() => setDays(w)}
              className={`rounded-full border-2 px-2.5 py-0.5 text-[0.75rem] font-bold ${days === w ? "border-ink bg-flame text-night" : "border-paper-edge bg-paper text-ink-muted"}`}
            >
              {w}{pick(lang, "d", " দিন")}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <div className="mt-3" role="alert">
          <p className="rounded-xl bg-paper px-3 py-3 text-sm text-ink-soft">{pick(lang, "Progress could not load. Your learning is not affected.", "অগ্রগতি লোড করা যায়নি। তোমার শেখায় কোনো সমস্যা হয়নি।")}</p>
          <button type="button" className="mt-2 text-sm font-bold text-brand-700 underline" onClick={() => void load(days)}>{pick(lang, "Try again", "আবার চেষ্টা করো")}</button>
        </div>
      ) : !trends ? (
        <div className="mt-3 h-32 animate-pulse rounded-xl bg-ink/5" role="status" aria-label={pick(lang, "Loading progress", "অগ্রগতি লোড হচ্ছে")} />
      ) : trends.totals.attempts === 0 && trends.sessionsByType.length === 0 ? (
        <p className="mt-3 rounded-xl bg-paper px-3 py-3 text-sm text-ink-soft">
          {pick(lang, "Not enough history yet. Answer questions on a few different days and your trends will appear here.", "এখনো যথেষ্ট ইতিহাস নেই। কয়েকটি আলাদা দিনে প্রশ্নের উত্তর দাও - তোমার প্রবণতা এখানে আসবে।")}
        </p>
      ) : (
        <div className="mt-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [pick(lang, "Active days", "সক্রিয় দিন"), `${trends.consistency.activeDays}/${trends.consistency.windowDays}`],
              [pick(lang, "Longest run", "সবচেয়ে লম্বা ধারাবাহিকতা"), `${trends.consistency.longestRunDays} ${pick(lang, "days", "দিন")}`],
              [pick(lang, "Accuracy change", "সঠিকের হারের বদল"), trends.accuracyDeltaPoints === null ? pick(lang, "Not enough data", "তথ্য যথেষ্ট নয়") : `${trends.accuracyDeltaPoints > 0 ? "+" : ""}${trends.accuracyDeltaPoints} pts`],
              [pick(lang, "Mastered", "আয়ত্ত হয়েছে"), `${trends.mastery.masteredAtWindowStart} → ${trends.mastery.masteredNow}`],
            ].map(([tileLabel, value]) => (
              <div key={tileLabel} className="rounded-xl bg-paper px-3 py-2">
                <dt className="text-[0.75rem] font-semibold text-ink-muted">{tileLabel}</dt>
                <dd className="font-display text-xl font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {(() => {
            const max = Math.max(1, ...trends.daily.map((d) => d.attempts));
            return (
              <div className="mt-4 flex h-24 items-end gap-[2px]" role="img" aria-label={pick(lang, "Questions answered per day", "প্রতিদিন উত্তর দেওয়া প্রশ্ন")}>
                {trends.daily.map((d) => (
                  <div key={d.date} className="min-w-[3px] flex-1 rounded-t bg-lagoon" style={{ height: `${Math.max(d.attempts > 0 ? 8 : 2, (d.attempts / max) * 100)}%` }} title={`${d.date}: ${d.attempts}`} />
                ))}
              </div>
            );
          })()}

          <table className="mt-3 w-full text-left text-xs text-ink-soft">
            <caption className="sr-only">{pick(lang, "Questions answered per day", "প্রতিদিন উত্তর দেওয়া প্রশ্ন")}</caption>
            <thead>
              <tr>
                <th className="py-1 pr-2 font-semibold">{pick(lang, "Day", "দিন")}</th>
                <th className="py-1 pr-2 font-semibold">{pick(lang, "Questions", "প্রশ্ন")}</th>
                <th className="py-1 pr-2 font-semibold">{pick(lang, "Correct", "সঠিক")}</th>
                <th className="py-1 font-semibold">{pick(lang, "Sessions done", "শেষ করা সেশন")}</th>
              </tr>
            </thead>
            <tbody>
              {trends.daily.filter((d) => d.attempts > 0 || d.sessionsCompleted > 0).map((d) => (
                <tr key={d.date} className="border-t border-paper-edge">
                  <td className="py-1 pr-2">{new Date(`${d.date}T12:00:00.000Z`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" })}</td>
                  <td className="py-1 pr-2">{d.attempts}</td>
                  <td className="py-1 pr-2">{d.correct}</td>
                  <td className="py-1">{d.sessionsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {trends.subjects.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {trends.subjects.map((s) => (
                <li key={s.subjectId} className="flex items-center justify-between gap-2 rounded-xl border border-paper-edge px-3 py-1.5 text-sm">
                  <span className="font-semibold text-ink">{s.subjectId}</span>
                  <span className="text-ink-muted">{s.correct}/{s.attempts} · {s.accuracy === null ? "-" : `${Math.round(s.accuracy * 100)}%`}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {trends.mastery.improvingConceptIds.length > 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              <span className="font-bold text-kolapata">{pick(lang, "Improving: ", "উন্নতি হচ্ছে: ")}</span>
              {trends.mastery.improvingConceptIds.map(label).join(", ")}
              <span className="block text-xs">{pick(lang, "Based on your recorded answers in this window.", "এই সময়ে তোমার রেকর্ড করা উত্তরের ভিত্তিতে।")}</span>
            </p>
          ) : null}
          {trends.mastery.stillWeakConceptIds.length > 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="font-bold text-shapla-ink">{pick(lang, "Still needs work: ", "এখনো অনুশীলন দরকার: ")}</span>
              {trends.mastery.stillWeakConceptIds.map(label).join(", ")}
            </p>
          ) : null}
          {trends.truncated ? (
            <p className="mt-2 text-xs text-ink-muted">{pick(lang, "Showing your most recent activity only - older history is not included in these totals.", "শুধু সাম্প্রতিক কার্যক্রম দেখানো হচ্ছে - পুরোনো ইতিহাস এই হিসাবে নেই।")}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
