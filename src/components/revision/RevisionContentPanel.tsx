"use client";

import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { pick, useLang } from "../../lib/i18n";
import { revisionFetch } from "../../lib/revision/client";
import type { RevisionContent } from "../../lib/revision/content";

/**
 * Revision explanation + flashcards for one concept (Part 08).
 * Content comes from GET /api/revision/content (Meta with offline
 * fallback); this component only renders and flips cards.
 */
export function RevisionContentPanel({ conceptId, onClose }: { conceptId: string; onClose: () => void }) {
  const { lang } = useLang();
  const [content, setContent] = useState<RevisionContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      void revisionFetch<{ content: RevisionContent }>(`/api/revision/content?conceptId=${encodeURIComponent(conceptId)}&lang=${lang}`)
        .then((res) => {
          if (!cancelled) setContent(res.content);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [conceptId, lang]);

  function flip(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-paper-edge bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.95rem] font-bold text-ink">{pick(lang, "Quick revision", "ঝটপট রিভিশন")}</h3>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-full bg-paper text-ink-soft" aria-label={pick(lang, "Close", "বন্ধ করো")}>
          <Icon name="x" className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      {failed ? (
        <p className="mt-2 text-sm text-ink-soft" role="alert">{pick(lang, "Revision help could not load right now. Your progress is safe.", "এখন রিভিশন সাহায্য লোড করা যাচ্ছে না। তোমার অগ্রগতি ঠিক আছে।")}</p>
      ) : !content ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-ink/5" role="status" aria-label={pick(lang, "Loading revision help", "রিভিশন সাহায্য লোড হচ্ছে")} />
      ) : (
        <>
          <p className="mt-1 text-xs font-semibold text-ink-muted">
            {content.source === "meta" ? pick(lang, "Made for this concept with AI help", "AI সাহায্যে এই টপিকের জন্য তৈরি") : pick(lang, "Offline revision help", "অফলাইন রিভিশন সাহায্য")}
          </p>
          <h4 className="mt-2 font-display text-lg font-bold text-ink">{content.explanation.title}</h4>
          {content.explanation.body.map((p) => (
            <p key={p.slice(0, 24)} className="mt-2 text-sm leading-relaxed text-ink-soft">{p}</p>
          ))}
          <p className="mt-3 rounded-lg bg-lagoon-soft px-3 py-2 text-sm text-ink"><strong>{pick(lang, "Example: ", "উদাহরণ: ")}</strong>{content.explanation.example}</p>
          <p className="mt-2 rounded-lg bg-coral-soft px-3 py-2 text-sm text-ink"><strong>{pick(lang, "Watch out: ", "সাবধান: ")}</strong>{content.explanation.commonMistake}</p>
          <h4 className="mt-4 text-sm font-bold text-ink">{pick(lang, "Flashcards - tap to flip", "ফ্ল্যাশকার্ড - উল্টাতে চাপ দাও")}</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {content.flashcards.map((card) => {
              const isFlipped = flipped.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={isFlipped}
                  onClick={() => flip(card.id)}
                  className={`min-h-20 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition-colors ${isFlipped ? "border-ink bg-night text-paper" : "border-paper-edge bg-paper text-ink"}`}
                >
                  {isFlipped ? card.back : card.front}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
