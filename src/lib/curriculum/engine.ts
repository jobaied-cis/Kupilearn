import {
  EngineException,
  MicroLessonSchema,
  RemediationSchema,
  TeachingScriptSchema,
  type ConceptDetails,
  type LessonRequest,
  type LessonResponse,
  type PrerequisiteContext,
} from "./types";
import type { ConceptGraphRepository } from "./graph/repository";
import {
  TEXTBOOK_SIMILARITY_THRESHOLD,
  tfCosineSimilarity,
  type SimilarityScorer,
  type TextbookCorpus,
} from "./textbook/textbook";
import type { LLMClient } from "./llm";
import {
  STRICT_RETRY_CONSTRAINT,
  buildMicroLessonPrompt,
  buildRemediationPrompt,
  buildTeachingScriptPrompt,
} from "./prompts";

export interface EngineDeps {
  graph: ConceptGraphRepository;
  corpus: TextbookCorpus;
  llm: LLMClient;
  scoreSimilarity?: SimilarityScorer;
}

/* ------------------------------------------------------------------ */
/* §3.1 Prerequisite context builder                                   */
/*                                                                     */
/* Blocking rule (matches the §2 schema validation rule): a concept    */
/* cannot be taught while any DIRECT (depth-1) hard prerequisite is    */
/* below its mastery threshold. Deeper unmet prerequisites stay in the */
/* context window as inactive context but surface for remediation when */
/* their own lesson is requested. Gaps are ordered deepest-first so    */
/* remediation always starts at the root gap.                          */
/* ------------------------------------------------------------------ */

export function buildPrerequisiteContext(
  details: ConceptDetails,
  learnerMastery: Record<string, number> = {},
): PrerequisiteContext {
  const masteryOf = (id: string): number => learnerMastery[id] ?? 0;
  const activePrerequisites = details.prerequisites
    .filter((p) => masteryOf(p.id) >= p.masteryThreshold)
    .map((p) => ({
      id: p.id,
      name: p.name,
      masteryThreshold: p.masteryThreshold,
      learnerMastery: masteryOf(p.id),
      depth: p.depth,
    }));
  const gapFlags = details.prerequisites
    .filter((p) => p.type === "hard" && p.depth === 1 && masteryOf(p.id) < p.masteryThreshold)
    .sort((a, b) => b.depth - a.depth)
    .map((p) => p.id);
  return {
    targetConcept: { id: details.concept.id, name: details.concept.name },
    activePrerequisites,
    gapFlags,
  };
}

/* ------------------------------------------------------------------ */
/* Main orchestration: verify → retrieve → generate → validate (§6).   */
/* Never throws for domain outcomes; infrastructure failures surface   */
/* as EngineException so routes can return structured error payloads.  */
/* ------------------------------------------------------------------ */

export async function generateLesson(input: LessonRequest, deps: EngineDeps): Promise<LessonResponse> {
  const { conceptId, learnerMastery } = input;
  const scorer = deps.scoreSimilarity ?? tfCosineSimilarity;

  const details = await readConceptDetails(deps.graph, conceptId);
  if (!details) {
    return failedResponse(conceptId, "CONCEPT_NOT_MAPPED", null);
  }

  const context = buildPrerequisiteContext(details, learnerMastery);
  const audit = { all_met: context.gapFlags.length === 0, missing_prerequisites: context.gapFlags };

  if (context.gapFlags.length > 0) {
    return generateRemediation(conceptId, details, context, audit, deps.llm);
  }

  const chapterText = await readChapterText(deps.corpus, details.chapter.ncertCode, conceptId);
  if (!chapterText) {
    return failedResponse(conceptId, "TEXTBOOK_CHAPTER_UNAVAILABLE", details);
  }

  const masteredNames = context.activePrerequisites.map((p) => p.name);
  const objectiveTexts = details.objectives.map((o) => o.text);
  const microPrompt = buildMicroLessonPrompt({
    classLevel: details.chapter.classLevel,
    subject: details.chapter.subject,
    conceptName: details.concept.name,
    textbookName: details.chapter.textbookName,
    chapterTitle: details.chapter.title,
    learningObjectiveText: objectiveTexts[0] ?? "Not mapped — align before classroom use.",
    masteredPrerequisites: masteredNames,
    difficulty: details.concept.difficulty,
    bloomLevel: details.concept.bloomLevel,
    textbookExcerpt: chapterText,
  });
  const scriptPrompt = buildTeachingScriptPrompt({
    classLevel: details.chapter.classLevel,
    subject: details.chapter.subject,
    chapterTitle: details.chapter.title,
    conceptNames: [details.concept.name],
    objectiveTexts,
    allHardPrerequisitesMet: true,
    prerequisiteConcepts: masteredNames,
    textbookExcerpt: chapterText,
  });

  let microLesson, teachingScript;
  try {
    [microLesson, teachingScript] = await Promise.all([
      deps.llm.generateJSON(microPrompt.text, MicroLessonSchema),
      deps.llm.generateJSON(scriptPrompt.text, TeachingScriptSchema),
    ]);
  } catch (error) {
    throw new EngineException("LESSON_GENERATION_FAILED", conceptId, messageOf(error));
  }

  // §3.2 curriculum mapping validator: one strict retry, then reject.
  let score = await scorer(scriptText(teachingScript), chapterText);
  if (score < TEXTBOOK_SIMILARITY_THRESHOLD) {
    try {
      teachingScript = await deps.llm.generateJSON(
        `${scriptPrompt.text}\n${STRICT_RETRY_CONSTRAINT}`,
        TeachingScriptSchema,
      );
    } catch (error) {
      throw new EngineException("LESSON_GENERATION_FAILED", conceptId, messageOf(error));
    }
    score = await scorer(scriptText(teachingScript), chapterText);
    if (score < TEXTBOOK_SIMILARITY_THRESHOLD) {
      return failedResponse(conceptId, "LOW_TEXTBOOK_SIMILARITY", details);
    }
  }

  return {
    engine_status: "ready",
    concept_id: conceptId,
    curriculum_alignment: alignmentOf(details),
    prerequisite_audit: audit,
    lesson_payload: { micro_lesson: microLesson, teaching_script: teachingScript },
    validation: {
      textbook_similarity_score: round4(score),
      bloom_level_verified: details.concept.bloomLevel,
    },
  };
}

async function generateRemediation(
  conceptId: string,
  details: ConceptDetails,
  context: PrerequisiteContext,
  audit: { all_met: boolean; missing_prerequisites: string[] },
  llm: LLMClient,
): Promise<LessonResponse> {
  const missingId = context.gapFlags[0] as string;
  const missing = details.prerequisites.find((p) => p.id === missingId);
  const prompt = buildRemediationPrompt({
    classLevel: details.chapter.classLevel,
    targetConcept: details.concept.name,
    missingPrerequisite: missing?.name ?? missingId,
  });
  try {
    const remediation = await llm.generateJSON(prompt.text, RemediationSchema);
    return {
      engine_status: "remediation_required",
      concept_id: conceptId,
      curriculum_alignment: alignmentOf(details),
      prerequisite_audit: audit,
      lesson_payload: null,
      validation: null,
      remediation,
    };
  } catch (error) {
    throw new EngineException("REMEDIATION_GENERATION_FAILED", conceptId, messageOf(error));
  }
}

/* ------------------------------------------------------------------ */
/* §6 batch map-reduce: generate every concept of a chapter in         */
/* parallel (map), then assemble in prerequisite order (reduce).       */
/* ------------------------------------------------------------------ */

export interface ChapterBatchResult {
  chapter_id: string;
  ordered_concept_ids: string[];
  lessons: LessonResponse[];
}

export async function generateChapterLessons(
  chapterId: string,
  learnerMastery: Record<string, number>,
  deps: EngineDeps,
): Promise<ChapterBatchResult> {
  let chapter;
  try {
    chapter = await deps.graph.getChapterConcepts(chapterId);
  } catch (error) {
    throw asEngineException(error, "PREREQUISITE_DATA_UNAVAILABLE", "");
  }
  const order = topoSort(
    chapter.concepts.map((c) => c.id),
    chapter.hardEdges,
  );
  const lessons = await Promise.all(
    order.map((id) => generateLesson({ conceptId: id, learnerMastery }, deps)),
  );
  return { chapter_id: chapterId, ordered_concept_ids: order, lessons };
}

/**
 * Kahn's algorithm over hard edges. Deterministic: ties break
 * lexicographically. Throws CYCLIC_PREREQUISITES on dependency cycles.
 */
export function topoSort(ids: string[], hardEdges: [string, string][]): string[] {
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const [from, to] of hardEdges) {
    if (!indegree.has(from) || !indegree.has(to)) continue;
    outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }
  const ready = [...indegree.entries()]
    .filter(([, n]) => n === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if (indegree.get(next) === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }
  if (order.length !== ids.length) {
    throw new EngineException("CYCLIC_PREREQUISITES", "", "Prerequisite cycle detected in chapter");
  }
  return order;
}

/* ------------------------------- helpers ------------------------------- */

async function readConceptDetails(
  graph: ConceptGraphRepository,
  conceptId: string,
): Promise<ConceptDetails | null> {
  try {
    return await graph.getConceptDetails(conceptId);
  } catch (error) {
    throw asEngineException(error, "PREREQUISITE_DATA_UNAVAILABLE", conceptId);
  }
}

async function readChapterText(
  corpus: TextbookCorpus,
  ncertCode: string,
  conceptId: string,
): Promise<string | null> {
  try {
    return (await corpus.searchTextbookChapter(ncertCode))?.excerpt ?? null;
  } catch (error) {
    throw asEngineException(error, "TEXTBOOK_RETRIEVAL_FAILED", conceptId);
  }
}

function alignmentOf(details: ConceptDetails): LessonResponse["curriculum_alignment"] {
  return {
    ncert_chapter: `${details.chapter.textbookName}, Chapter: ${details.chapter.title} (${details.chapter.ncertCode})`,
    ncf_competency_code: details.objectives[0]?.competencyCode ?? "",
  };
}

function failedResponse(
  conceptId: string,
  reason: string,
  details: ConceptDetails | null,
): LessonResponse {
  return {
    engine_status: "generation_failed",
    concept_id: conceptId,
    curriculum_alignment: details
      ? alignmentOf(details)
      : { ncert_chapter: "", ncf_competency_code: "" },
    prerequisite_audit: { all_met: false, missing_prerequisites: [] },
    lesson_payload: null,
    validation: null,
    reason,
  };
}

function scriptText(script: { sections: { title: string; body: string }[] }): string {
  return script.sections.map((s) => `${s.title}. ${s.body}`).join(" ");
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asEngineException(error: unknown, code: string, conceptId: string): EngineException {
  if (error instanceof EngineException) return error;
  return new EngineException(code, conceptId, messageOf(error));
}
