import { z } from "zod";
import { REVISION_CONFIG } from "./config";
import { getConcept, listConcepts, type ConceptDefinition } from "./concepts";
import { NCTB_CATALOG } from "../nctb/catalog";
import { createLLMClient, type LLMClient } from "../curriculum/llm";
import { RevisionError } from "./types";

/**
 * AI revision explanations + flashcards (Part 08).
 *
 * Generated on demand through Kupi's existing Meta-only LLM path
 * (createLLMClient - no new provider, no new client). The prompt carries
 * ONLY curriculum data: concept, chapter, class level, key terms and the
 * NCTB topic summary. No student id, name, answers, or history is ever
 * included - content is concept-level, so it is also cacheable.
 *
 * Every response is Zod-validated and length-capped. If Meta is
 * unavailable, in mock mode, or returns invalid output, a deterministic
 * offline builder (grounded in the NCTB topic summary and key terms)
 * answers instead, labelled source:"offline" - never passed off as AI.
 */

const C = REVISION_CONFIG.content;

export const RevisionContentSchema = z.object({
  conceptId: z.string().min(1),
  language: z.enum(["en", "bn"]),
  source: z.enum(["meta", "offline"]),
  explanation: z.object({
    title: z.string().min(1).max(120),
    body: z.array(z.string().min(1).max(C.maxParagraphChars)).min(1).max(C.maxBodyParagraphs),
    example: z.string().min(1).max(300),
    commonMistake: z.string().min(1).max(300),
  }),
  flashcards: z
    .array(z.object({ id: z.string().min(1).max(60), front: z.string().min(1).max(C.maxCardFrontChars), back: z.string().min(1).max(C.maxCardBackChars) }))
    .min(C.flashcardMin)
    .max(C.flashcardMax),
});
export type RevisionContent = z.infer<typeof RevisionContentSchema>;

/** The model-facing payload (conceptId/language/source are added by us). */
const ModelPayloadSchema = RevisionContentSchema.omit({ conceptId: true, language: true, source: true });

function topicSummary(topicId: string): string {
  for (const cls of NCTB_CATALOG) {
    for (const subject of cls.subjects) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          if (topic.id === topicId) return topic.objective;
        }
      }
    }
  }
  return "";
}

/** Deterministic, curriculum-grounded fallback. No model involved. */
export function buildOfflineContent(concept: ConceptDefinition, language: "en" | "bn"): RevisionContent {
  const summary = topicSummary(concept.topicId) || `${concept.name} is part of ${concept.chapterTitle} for Class ${concept.classLevel}.`;
  const subConcepts = listConcepts({ topicId: concept.topicId }).filter((c) => c.id !== concept.id);
  const terms = concept.keyTerms.length > 0 ? concept.keyTerms : [concept.name];
  const cards = (subConcepts.length > 0
    ? subConcepts.map((s) => ({ id: `card-${s.id}`, front: s.name, back: `A key part of ${concept.name}. ${summary}` }))
    : terms.map((t) => ({ id: `card-${concept.id}-${t.replace(/\s+/g, "-")}`, front: t, back: `A key term in ${concept.name} (${concept.chapterTitle}). ${summary}` }))
  ).slice(0, C.flashcardMax);
  while (cards.length < C.flashcardMin) {
    cards.push({ id: `card-${concept.id}-recall-${cards.length}`, front: concept.name, back: summary });
  }
  const bn = language === "bn";
  return {
    conceptId: concept.id,
    language,
    source: "offline",
    explanation: {
      title: bn ? `${concept.nameBn} - আবার দেখে নাও` : `${concept.name} - a quick revision`,
      body: [
        summary,
        bn
          ? `মূল শব্দগুলো মনে রাখো: ${terms.join(", ")}। প্রতিটি শব্দ নিজের ভাষায় বলতে পারলেই বুঝবে তুমি ধরতে পেরেছ।`
          : `Keep these key terms in mind: ${terms.join(", ")}. If you can say each one in your own words, you have understood ${concept.name}.`,
      ].map((p) => p.slice(0, C.maxParagraphChars)),
      example: bn
        ? `নিজে চেষ্টা করো: ${concept.name} থেকে একটি ছোট উদাহরণ লিখে দেখো।`
        : `Try it yourself: write one small example that uses ${concept.name}, then check it against the idea above.`,
      commonMistake: bn
        ? "শুধু মুখস্থ করলে ভুল হয় - প্রতিটি ধাপ কেন হলো, তা বলতে শেখো।"
        : "Memorising without understanding is the common mistake here - practise saying why each step works.",
    },
    flashcards: cards.map((c) => ({ ...c, front: c.front.slice(0, C.maxCardFrontChars), back: c.back.slice(0, C.maxCardBackChars) })),
  };
}

/**
 * Builds the Meta prompt. Exported for tests: it must never contain
 * student-identifying data - note there is no student parameter at all.
 */
export function buildRevisionPrompt(concept: ConceptDefinition, language: "en" | "bn"): string {
  const summary = topicSummary(concept.topicId);
  return [
    "[TEMPLATE:REVISION_CONTENT]",
    `Concept: ${concept.name} (Class ${concept.classLevel}, chapter: ${concept.chapterTitle})`,
    `Key Terms: ${concept.keyTerms.join(", ")}`,
    `Textbook summary: ${summary}`,
    `Write a short revision explanation for a Bangladeshi school student in ${language === "bn" ? "Bangla" : "English"}.`,
    "Return ONLY JSON with this shape:",
    '{"explanation":{"title":"...","body":["...","..."],"example":"...","commonMistake":"..."},"flashcards":[{"id":"card-1","front":"...","back":"..."}]}',
    `Rules: body 2-4 short paragraphs; exactly 3-5 flashcards; stay faithful to the textbook summary; simple friendly language; no markdown.`,
  ].join("\n");
}

export class RevisionContentService {
  private cache = new Map<string, RevisionContent>();

  constructor(private llmFactory: () => LLMClient = createLLMClient) {}

  async getContent(conceptId: string, language: "en" | "bn"): Promise<RevisionContent> {
    const concept = getConcept(conceptId);
    if (!concept) throw new RevisionError("CONCEPT_NOT_FOUND", 404, `Unknown conceptId: ${conceptId}`);
    const cacheKey = `${conceptId}|${language}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let content: RevisionContent;
    try {
      const payload = await this.llmFactory().generateJSON(buildRevisionPrompt(concept, language), ModelPayloadSchema);
      content = RevisionContentSchema.parse({ conceptId, language, source: "meta", ...payload });
    } catch {
      // Meta unavailable / mock mode / invalid model output: the
      // deterministic offline builder answers, honestly labelled.
      content = buildOfflineContent(concept, language);
    }
    this.cache.set(cacheKey, content);
    return content;
  }

  /** Test hook: number of cached concept/language entries. */
  get cacheSize(): number {
    return this.cache.size;
  }
}

let shared: RevisionContentService | null = null;
export function getRevisionContentService(): RevisionContentService {
  shared ??= new RevisionContentService();
  return shared;
}
