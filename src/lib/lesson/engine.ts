import { z } from "zod";
import type { LLMClient } from "../curriculum/llm";
import { createLLMClient } from "../curriculum/llm";
import { isMetaConfigured } from "../meta/meta-client";
import { findTopic, firstTopic } from "../nctb/catalog";
import { retrieve, type RetrievedPassage } from "../rag/retrieve";
import { getMathChapter } from "../nctb/math-book";

/**
 * Lesson & Context Engine: Class → Subject → Chapter → Topic → Micro-lesson.
 * Output is a validated StructuredLesson. Generation uses the Meta teacher
 * model (via createLLMClient); on any failure it falls back to a
 * deterministic offline lesson built from the NCTB topic objective, and
 * reports `degraded: true` — it never invents a live result.
 */

export const VizInstructionSchema = z.object({
  kind: z.enum(["write", "equation", "diagram", "chart", "timeline", "highlight", "label", "clear"]),
  content: z.string().min(1).max(500),
  /** For chart: "Label:value,Label:value". For timeline: "Year:event | ...". */
  data: z.string().max(500).optional(),
});
export type VizInstruction = z.infer<typeof VizInstructionSchema>;

export const LessonQuestionSchema = z.object({
  question: z.string().min(1).max(400),
  options: z.array(z.string().min(1).max(120)).max(4).default([]),
  answer: z.string().min(1).max(200),
  hint: z.string().min(1).max(300),
});
export type LessonQuestion = z.infer<typeof LessonQuestionSchema>;

export const StructuredLessonSchema = z.object({
  id: z.string().min(1),
  classLevel: z.number().int().min(6).max(10),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  topic: z.string().min(1),
  topicBn: z.string().default(""),
  introduction: z.string().min(1).max(800),
  explanations: z.array(z.object({
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(1200),
    board: z.array(VizInstructionSchema).min(1).max(6),
  })).min(2).max(5),
  examples: z.array(z.string().min(1).max(600)).min(1).max(4),
  questions: z.array(LessonQuestionSchema).min(1).max(5),
  practice: z.array(z.string().min(1).max(400)).min(1).max(4),
  summary: z.string().min(1).max(800),
});
export type StructuredLesson = z.infer<typeof StructuredLessonSchema>;

export interface LessonResult {
  lesson: StructuredLesson;
  provider: "meta" | "offline";
  degraded: boolean;
  /** Textbook passages retrieved before generation (RAG grounding). */
  sources: RetrievedPassage[];
  /** True when no relevant textbook passage exists - must be shown honestly. */
  missingSource: boolean;
}

export function offlineLesson(classLevel: number, topicId?: string): StructuredLesson {
  const found = (topicId ? findTopic(classLevel, topicId) : null) ?? firstTopic(classLevel);
  if (!found) throw new Error(`No NCTB topic for class ${classLevel}`);
  const { subject, chapter, topic } = found;
  const terms = topic.keyTerms.join(", ") || topic.title;
  return StructuredLessonSchema.parse({
    id: topic.id,
    classLevel,
    subject: subject.title,
    chapter: chapter.title,
    topic: topic.title,
    topicBn: topic.titleBn,
    introduction: `Today we learn ${topic.title}. ${topic.objective} We will go step by step, with examples from daily life in Bangladesh.`,
    explanations: [
      {
        title: "The big idea",
        body: `${topic.objective} Start by naming what you already know about ${terms}. Your teacher will build the new idea on that, one small step at a time.`,
        board: [
          { kind: "write", content: topic.title },
          { kind: "highlight", content: topic.objective },
          { kind: "label", content: `Key words: ${terms}` },
        ],
      },
      {
        title: "Step by step",
        body: `Step 1: read the problem or idea carefully. Step 2: find the key words (${terms}). Step 3: apply the rule slowly and check each line. Step 4: say the answer in your own words.`,
        board: [
          { kind: "write", content: "Step 1 → Read carefully" },
          { kind: "write", content: "Step 2 → Find key words" },
          { kind: "write", content: "Step 3 → Apply the rule, check each line" },
          { kind: "equation", content: "2x - 1 = 5 \\;\\Rightarrow\\; x = 3" },
        ],
      },
      {
        title: "A picture helps",
        body: `When words feel hard, draw it. A simple diagram, chart or timeline often makes ${topic.title} click. Watch the board and copy the picture into your notebook.`,
        board: [
          { kind: "chart", content: "Understanding grows with practice", data: "Day 1:20,Day 3:45,Day 7:80" },
          { kind: "timeline", content: "How we learn today", data: "Start:Idea|Middle:Example|End:Check" },
          { kind: "diagram", content: topic.title },
        ],
      },
    ],
    examples: [
      `Example from daily life: explain ${topic.title} using something from your home, market or cricket field.`,
      `Worked example: your teacher solves one case slowly on the board, saying every step out loud.`,
    ],
    questions: [
      { question: `In your own words, what is the main idea of ${topic.title}?`, options: [], answer: topic.objective, hint: `Think about: ${terms}.` },
      { question: "Which is the best first step when you start a new problem?", options: ["Guess the answer", "Read carefully and find key words", "Copy a friend", "Skip it"], answer: "Read carefully and find key words", hint: "Slow is fast at the start." },
    ],
    practice: [
      `Explain ${topic.title} to an imaginary classmate in 3 sentences.`,
      `Write one example of ${topic.title} from your daily life.`,
      "Answer the checkpoint question without looking at the board.",
    ],
    summary: `Today: ${topic.objective} Remember the key words (${terms}), go step by step, and always check your answer.`,
  });
}

export async function generateLesson(
  input: { classLevel: number; topicId?: string; chapterId?: string; query?: string; language?: "en" | "bn"; difficulty?: number },
  llm: LLMClient = createLLMClient(),
): Promise<LessonResult> {
  let fallback = offlineLesson(input.classLevel, input.topicId);
  const mathChapter = input.chapterId ? getMathChapter(input.chapterId) : null;
  if (mathChapter) {
    // Ground the fallback in the real uploaded textbook chapter (objectives
    // transcribed from its first page) instead of the generic catalog.
    fallback = {
      ...fallback,
      id: mathChapter.id,
      subject: "Mathematics",
      chapter: mathChapter.title,
      topic: input.query && input.query !== mathChapter.title ? input.query : mathChapter.title,
      topicBn: mathChapter.titleBn,
      introduction: `Today we study ${mathChapter.title} from your NCTB Mathematics book (Chapter ${mathChapter.number}, book page ${mathChapter.bookPage}). By the end you will be able to: ${mathChapter.objectives.slice(0, 3).join(" ")}`,
      summary: `${mathChapter.title}: ${mathChapter.objectives.join(" ")} (Source: ${mathChapter.source}.)`,
    };
  }
  const sources = retrieve(input.query ?? `${fallback.chapter} ${fallback.topic}`, {
    classLevel: input.classLevel,
    chapterId: input.chapterId,
    limit: 8,
  });
  const missingSource = sources.length === 0;
  const liveProvider = isMetaConfigured() ? "meta" : null;
  if (!liveProvider) return { lesson: fallback, provider: "offline", degraded: true, sources, missingSource };
  const prompt = [
    "[TEMPLATE:LESSON]",
    "Generate one NCTB micro-lesson as JSON only, matching this shape:",
    '{"id":string,"classLevel":number,"subject":string,"chapter":string,"topic":string,"topicBn":string,"introduction":string,"explanations":[{"title":string,"body":string,"board":[{"kind":"write|equation|diagram|chart|timeline|highlight|label|clear","content":string,"data"?:string}]}],"examples":[string],"questions":[{"question":string,"options":[string],"answer":string,"hint":string}],"practice":[string],"summary":string}',
    `Class: ${input.classLevel}. Subject: ${fallback.subject}. Chapter: ${fallback.chapter}. Topic: ${fallback.topic} (${fallback.topicBn}).`,
    `Objective: ${fallback.introduction}`,
    `Language: ${input.language === "bn" ? "Bangla" : "English"}. Difficulty 1-3: ${input.difficulty ?? 2}.`,
    sources.length
      ? `Textbook passages (cite these; do not invent chapters, exercises or page numbers beyond them):\n${sources.map((x) => `- [book p.${x.bookPage}] ${x.text}`).join("\n")}`
      : "Textbook passages: NONE FOUND. Say clearly in the introduction that the textbook source is missing for this topic; teach only the stated objective and do not invent textbook references.",
    "Write everything in English only: explanations, examples, questions and all whiteboard content. Use Bangladesh daily-life examples. Board equations use LaTeX without $ delimiters. Keep each board content short.",
    "Visualization rule: every explanation must visualize its own textbook content on the board — at least one diagram, chart, timeline or equation per explanation, drawn from the passages above (mention the book page in a board label like 'Book p. 110'). Never produce a text-only explanation.",
  ].join("\n");
  try {
    const raw = await llm.generateJSON(prompt, StructuredLessonSchema);
    return { lesson: { ...raw, id: fallback.id, classLevel: input.classLevel }, provider: liveProvider, degraded: false, sources, missingSource };
  } catch {
    return { lesson: fallback, provider: "offline", degraded: true, sources, missingSource };
  }
}

/** Bounded session memory for one classroom session (server-echoed by client). */
export interface SessionMemory {
  lessonId: string;
  history: { role: "teacher" | "classmate" | "student"; text: string }[];
  coveredSteps: number;
  correct: number;
  attempted: number;
}
export function emptySession(lessonId: string): SessionMemory {
  return { lessonId, history: [], coveredSteps: 0, correct: 0, attempted: 0 };
}
export function remember(mem: SessionMemory, role: SessionMemory["history"][number]["role"], text: string): SessionMemory {
  return { ...mem, history: [...mem.history.slice(-39), { role, text: text.slice(0, 280) }] };
}
