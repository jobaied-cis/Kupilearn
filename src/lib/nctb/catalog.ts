import { z } from "zod";

/**
 * NCTB-aligned catalog: Class → Subject → Chapter → Topic.
 * Topic titles/objectives only — no verbatim textbook text is stored or
 * claimed. Lesson bodies are generated (Meta) or built by the offline
 * fallback from these objectives.
 */

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleBn: z.string().min(1),
  objective: z.string().min(1),
  keyTerms: z.array(z.string()).default([]),
});
export const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleBn: z.string().min(1),
  topics: z.array(TopicSchema).min(1),
});
export const SubjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleBn: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
});
export const ClassCatalogSchema = z.object({
  classLevel: z.number().int().min(6).max(10),
  subjects: z.array(SubjectSchema).min(1),
});
export type Topic = z.infer<typeof TopicSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type ClassCatalog = z.infer<typeof ClassCatalogSchema>;

const t = (id: string, title: string, titleBn: string, objective: string, keyTerms: string[] = []): Topic => ({ id, title, titleBn, objective, keyTerms });
const ch = (id: string, title: string, titleBn: string, topics: Topic[]): Chapter => ({ id, title, titleBn, topics });
const sub = (id: string, title: string, titleBn: string, chapters: Chapter[]): Subject => ({ id, title, titleBn, chapters });

function subjectsFor(cls: number): Subject[] {
  return [
    sub("math", "Mathematics", "গণিত", [
      ch("math-number", "Numbers & Fractions", "সংখ্যা ও ভগ্নাংশ", [
        t("math-factors", "Factors, Multiples, LCM & HCF", "গুণনীয়ক, গুণিতক, ল.সা.গু ও গ.সা.গু", "Find factors and multiples; compute LCM and HCF of two numbers.", ["factor", "multiple", "LCM", "HCF"]),
        t("math-fractions", "Fractions: Compare & Calculate", "ভগ্নাংশ: তুলনা ও হিসাব", "Compare, add and subtract fractions with unlike denominators.", ["fraction", "denominator"]),
      ]),
      ch("math-algebra", "Algebra & Equations", "বীজগণিত ও সমীকরণ", [
        t("math-algebraic", "Algebraic Expressions", "বীজগণিতীয় রাশি", "Read, build and simplify algebraic expressions using variables.", ["variable", "expression", "coefficient"]),
        t("math-equations", "Solving Simple Equations", "সরল সমীকরণের সমাধান", "Solve one-variable equations by balancing both sides, then verify.", ["equation", "balance", "verify"]),
      ]),
      ch("math-geometry", "Geometry & Measurement", "জ্যামিতি ও পরিমাপ", [
        t("math-angles", "Lines, Angles & Triangles", "রেখা, কোণ ও ত্রিভুজ", "Identify angle types and angle sums in triangles.", ["angle", "triangle"]),
        t("math-area", "Area & Perimeter", "ক্ষেত্রফল ও পরিসীমা", "Compute area and perimeter of rectangles, squares and triangles.", ["area", "perimeter"]),
      ]),
    ]),
    sub("science", "Science", "বিজ্ঞান", [
      ch("sci-living", "Living World", "জীবজগৎ", [
        t("sci-plants", "Nutrition in Plants", "উদ্ভিদে পুষ্টি", "Explain how green plants make food by photosynthesis.", ["photosynthesis", "chlorophyll", "stomata"]),
        t("sci-animals", "Nutrition in Animals", "প্রাণীতে পুষ্টি", "Describe digestion stages from ingestion to absorption.", ["digestion", "absorption"]),
      ]),
      ch("sci-matter", "Matter, Force & Energy", "পদার্থ, বল ও শক্তি", [
        t("sci-force", "Force & Motion", "বল ও গতি", "Relate force, speed and simple motion in daily life.", ["force", "speed", "motion"]),
        t("sci-light", "Light: Reflection", "আলো: প্রতিফলন", "State and apply the laws of reflection with ray diagrams.", ["reflection", "ray", "mirror"]),
      ]),
    ]),
    sub("bangla", "Bangla", "বাংলা", [
      ch("bn-grammar", "Language & Grammar", "ভাষা ও ব্যাকরণ", [
        t("bn-parts", "Parts of Speech (পদ)", "পদ পরিচিতি", "Identify noun, pronoun, adjective, verb and adverb in sentences.", ["পদ", "বিশেষ্য", "ক্রিয়া"]),
        t("bn-sandhi", "Sandhi (সন্ধি)", "সন্ধি", "Join and split common Bangla sandhi forms correctly.", ["সন্ধি"]),
      ]),
      ch("bn-lit", "Literature", "সাহিত্য", [
        t("bn-poem", "Reading a Poem: Main Idea", "কবিতার মূলভাব", "Find the central idea and imagery of a poem.", ["মূলভাব", "রূপক"]),
      ]),
    ]),
    sub("english", "English", "ইংরেজি", [
      ch("en-grammar", "English Grammar", "English Grammar", [
        t("en-tense", "Present & Past Tense", "Present & Past Tense", "Use present and past tense forms correctly in context.", ["tense", "verb"]),
        t("en-speech", "Parts of Speech", "Parts of Speech", "Identify nouns, verbs, adjectives and adverbs in sentences.", ["noun", "verb", "adverb"]),
      ]),
      ch("en-reading", "Reading & Vocabulary", "Reading & Vocabulary", [
        t("en-comp", "Reading Comprehension", "Reading Comprehension", "Answer who/what/why questions from a short passage.", ["comprehension", "passage"]),
      ]),
    ]),
    sub("bgs", "Bangladesh & Global Studies", "বাংলাদেশ ও বিশ্বপরিচয়", [
      ch("bgs-history", "History of Bangladesh", "বাংলাদেশের ইতিহাস", [
        t("bgs-language", "Language Movement 1952", "ভাষা আন্দোলন ১৯৫২", "Sequence the key events of the 1952 Language Movement.", ["1952", "Ekushey"]),
        t("bgs-liberation", "Liberation War: Key Events", "মুক্তিযুদ্ধ: মূল ঘটনা", "Outline major events of the 1971 Liberation War.", ["1971", "independence"]),
      ]),
      ch("bgs-geo", "Geography & Environment", "ভূগোল ও পরিবেশ", [
        t("bgs-rivers", "Rivers of Bangladesh", "বাংলাদেশের নদ-নদী", "Locate major rivers and explain their importance.", ["river", "delta"]),
      ]),
    ]),
    sub("ict", "ICT", "তথ্য ও যোগাযোগ প্রযুক্তি", [
      ch("ict-basics", "Computer & Internet", "কম্পিউটার ও ইন্টারনেট", [
        t("ict-parts", "Parts of a Computer", "কম্পিউটারের অংশ", "Name input, processing, output and storage devices.", ["CPU", "input", "output"]),
        t("ict-safety", "Staying Safe Online", "অনলাইনে নিরাপত্তা", "Apply passwords, privacy and safe-browsing habits.", ["password", "privacy"]),
      ]),
      ch("ict-prog", "Intro to Programming", "প্রোগ্রামিংয়ের হাতেখড়ি", [
        t("ict-algo", "Algorithms & Flowcharts", "অ্যালগরিদম ও ফ্লোচার্ট", "Write a step-by-step algorithm and draw its flowchart.", ["algorithm", "flowchart"]),
      ]),
    ]),
  ].map((s) => ({
    ...s,
    id: `c${cls}-${s.id}`,
    chapters: s.chapters.map((c) => ({ ...c, id: `c${cls}-${c.id}`, topics: c.topics.map((tp) => ({ ...tp, id: `c${cls}-${tp.id}` })) })),
  }));
}

export const NCTB_CATALOG: ClassCatalog[] = [6, 7, 8, 9, 10].map((classLevel) => ({
  classLevel,
  subjects: subjectsFor(classLevel),
}));

export function getClass(classLevel: number): ClassCatalog | null {
  return NCTB_CATALOG.find((c) => c.classLevel === classLevel) ?? null;
}
export function findTopic(classLevel: number, topicId: string): { subject: Subject; chapter: Chapter; topic: Topic } | null {
  const cls = getClass(classLevel);
  if (!cls) return null;
  for (const subject of cls.subjects) {
    for (const chapter of subject.chapters) {
      const topic = chapter.topics.find((tp) => tp.id === topicId);
      if (topic) return { subject, chapter, topic };
    }
  }
  return null;
}
export function firstTopic(classLevel: number): { subject: Subject; chapter: Chapter; topic: Topic } | null {
  const cls = getClass(classLevel);
  const subject = cls?.subjects[0];
  const chapter = subject?.chapters[0];
  const topic = chapter?.topics[0];
  return subject && chapter && topic ? { subject, chapter, topic } : null;
}
