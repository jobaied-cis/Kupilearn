import { findTopic } from "../nctb/catalog";
import { CLASS6_MATH } from "../nctb/math-book";

/**
 * NCTB Curriculum Context Engine (Step 03).
 *
 * Represents curriculum structure traceably: every field comes from
 * the repo's NCTB catalog (`src/lib/nctb/catalog.ts`) or, for Class 6
 * Mathematics, the transcribed textbook (`src/lib/nctb/math-book.ts`,
 * NCTB Mathematics Class Six, Revised Edition Oct 2025). Nothing —
 * chapter numbers, pages, titles — is invented here. Where a mapping
 * is our own pedagogical judgement (prerequisites, catalog-topic →
 * textbook-chapter links), the context says so via its source fields.
 */

export const CURRICULUM_CONTEXT_VERSION = "kupi-curriculum-context-v1";

export type CurriculumApproval = "verified" | "draft-sample";

export interface CurriculumContext {
  version: string;
  /** Where the structure came from. */
  source: "nctb-textbook" | "nctb-catalog" | "draft-sample";
  /** Human-traceable source reference (edition / catalog), never a fabricated page. */
  sourceRef: string;
  classLevel: number;
  subjectId: string;
  subjectTitle: string;
  chapterId: string;
  chapterTitle: string;
  topicId: string;
  topicTitle: string;
  subtopicTitle?: string;
  learningObjective: string;
  /** Prerequisite concept titles (our draft mapping, labelled as such when used). */
  prerequisites: string[];
  prerequisitesSource: "draft-sample" | "none";
  difficulty: 1 | 2 | 3;
  approvalStatus: CurriculumApproval;
}

/**
 * Catalog topic -> verified Class 6 textbook chapter. The catalog and
 * the textbook are two different structures in this repo; this link
 * table is the traceable bridge, and it only claims chapters whose
 * titles genuinely cover the topic (fractions/numbers -> Chapter One,
 * algebraic expressions -> Chapter Four, simple equations -> Chapter
 * Five, geometry basics -> Chapter Six).
 */
const C6_MATH_TOPIC_TO_BOOK_CHAPTER: Record<string, string> = {
  "c6-math-factors": "c6m-ch1",
  "c6-math-fractions": "c6m-ch1",
  "c6-math-algebraic": "c6m-ch4",
  "c6-math-equations": "c6m-ch5",
  "c6-math-angles": "c6m-ch6",
  "c6-math-area": "c6m-ch6",
};

const PREREQUISITES: Record<string, string[]> = {
  "c6-math-fractions": ["Natural numbers", "Multiplication and division facts"],
  "c6-math-equations": ["Algebraic expressions", "Inverse operations"],
  "c6-math-algebraic": ["Natural numbers", "Letters standing for numbers"],
  "c6-math-angles": ["Lines and points", "Measuring angles"],
  "c6-math-factors": ["Multiplication tables", "Division"],
  "c6-math-area": ["Rectangles and squares", "Multiplication"],
};

export function resolveCurriculumContext(input: {
  classLevel: number;
  topicId: string;
  difficulty?: 1 | 2 | 3;
}): CurriculumContext | null {
  const found = findTopic(input.classLevel, input.topicId);
  if (!found) return null;
  const { subject, chapter, topic } = found;
  const difficulty = input.difficulty ?? 1;
  const prerequisites = PREREQUISITES[topic.id] ?? [];
  const base: CurriculumContext = {
    version: CURRICULUM_CONTEXT_VERSION,
    source: "nctb-catalog",
    sourceRef: "Kupi NCTB catalog (src/lib/nctb/catalog.ts)",
    classLevel: input.classLevel,
    subjectId: subject.id,
    subjectTitle: subject.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    topicId: topic.id,
    topicTitle: topic.title,
    learningObjective: topic.objective,
    prerequisites,
    prerequisitesSource: prerequisites.length > 0 ? "draft-sample" : "none",
    difficulty,
    approvalStatus: "draft-sample",
  };
  if (input.classLevel === 6 && subject.id === "c6-math") {
    const bookChapterId = C6_MATH_TOPIC_TO_BOOK_CHAPTER[topic.id];
    const bookChapter = CLASS6_MATH.chapters.find((c) => c.id === bookChapterId);
    if (bookChapter) {
      return {
        ...base,
        source: "nctb-textbook",
        sourceRef: `${CLASS6_MATH.edition}, Chapter ${bookChapter.number} (book p. ${bookChapter.bookPage})`,
        chapterId: bookChapter.id,
        chapterTitle: bookChapter.title,
        subtopicTitle: bookChapter.subtopics[0]?.title,
        approvalStatus: "verified",
      };
    }
  }
  return base;
}
