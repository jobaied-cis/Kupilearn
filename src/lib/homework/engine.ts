import { z } from "zod";
import { createRng, randInt } from "../practice/engine";
import { findTopic, type Topic } from "../nctb/catalog";
import { adaptLearner, type LearnerProfile } from "../learner/adapt";

/**
 * Homework engine: assignments are first-class records (not static
 * copy). They are generated from NCTB topics, carry real due times, and
 * track completion — so Home due counts and Progress read true data.
 */

export const DueBucketSchema = z.enum(["tonight", "tomorrow", "friday", "weekend", "custom"]);
export type DueBucket = z.infer<typeof DueBucketSchema>;

export const HomeworkTaskSchema = z.object({
  text: z.string().min(1).max(300),
  textBn: z.string().min(1).max(350),
  done: z.boolean().default(false),
});
export type HomeworkTask = z.infer<typeof HomeworkTaskSchema>;

export const HomeworkAssignmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  titleBn: z.string().min(1).max(200),
  subjectId: z.string().min(1),
  subjectTitle: z.string().min(1),
  topicId: z.string().min(1),
  topicTitle: z.string().min(1),
  instructions: z.string().min(1).max(600),
  instructionsBn: z.string().min(1).max(700),
  /** Tickable sub-steps; empty for free-form custom entries. Defaults keep
   *  assignments stored before checklists existed valid. */
  tasks: z.array(HomeworkTaskSchema).default([]),
  /** Rough effort estimate shown on the card. */
  estMinutes: z.number().int().positive().default(10),
  /** Repeating work (e.g. daily reading) spawns its next occurrence on completion. */
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  source: z.enum(["starter", "lesson", "custom", "practice"]),
  dueBucket: DueBucketSchema,
  /** ISO timestamp the work is due by. */
  dueAt: z.string().min(1),
  status: z.enum(["assigned", "done"]),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable().default(null),
});
export type HomeworkAssignment = z.infer<typeof HomeworkAssignmentSchema>;

/* ---------------- due times ---------------- */

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** Bucket → absolute due time, relative to `now` (local time). */
export function dueAtForBucket(bucket: DueBucket, now: Date, customIso?: string): Date {
  if (bucket === "custom" && customIso) {
    const parsed = new Date(customIso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (bucket === "tomorrow" || bucket === "custom") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return endOfDay(d);
  }
  if (bucket === "friday") {
    const d = new Date(now);
    const delta = (5 - d.getDay() + 7) % 7; // next Friday; 0 when today is Friday
    d.setDate(d.getDate() + delta);
    return endOfDay(d);
  }
  if (bucket === "weekend") {
    const d = new Date(now);
    const delta = (6 - d.getDay() + 7) % 7; // next Saturday; 0 when today is Saturday
    d.setDate(d.getDate() + delta);
    return endOfDay(d);
  }
  return endOfDay(now); // tonight
}

export function isOverdue(a: HomeworkAssignment, now: Date): boolean {
  return a.status !== "done" && new Date(a.dueAt).getTime() < now.getTime();
}

/** Pending work due by end of tomorrow — the Home "today" count. */
export function dueSoonCount(list: HomeworkAssignment[], now: Date): number {
  const horizon = endOfDay(new Date(now.getTime() + 24 * 3600 * 1000)).getTime();
  return list.filter((a) => a.status !== "done" && new Date(a.dueAt).getTime() <= horizon).length;
}

export function completionStats(list: HomeworkAssignment[]): { done: number; total: number; rate: number } {
  const done = list.filter((a) => a.status === "done").length;
  return { done, total: list.length, rate: list.length > 0 ? Math.round((done / list.length) * 100) : 0 };
}

/** Overdue first, then soonest due; completed sink to the bottom. */
export function sortForDisplay(list: HomeworkAssignment[], now: Date): HomeworkAssignment[] {
  const rank = (a: HomeworkAssignment) => (a.status === "done" ? 2 : isOverdue(a, now) ? 0 : 1);
  return [...list].sort(
    (a, b) => rank(a) - rank(b) || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
}

/* ---------------- generation from topics ---------------- */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (value: string | number): string =>
  String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!);

interface TopicContext {
  subjectId: string;
  subjectTitle: string;
  topic: Topic;
}

/* ---------------- learner persona ---------------- */

/**
 * Homework is shaped by the learner's persona: self-chosen style and
 * pace (from onboarding, changeable anytime) plus behavior-derived
 * difficulty. Style changes how work is framed, pace changes volume,
 * difficulty changes number ranges — never a label about the learner.
 */
export interface HomeworkPersona {
  style: LearnerProfile["preferredStyle"];
  pace: LearnerProfile["pace"];
  difficulty: 1 | 2 | 3;
}

export function personaFromLearner(learner: LearnerProfile): HomeworkPersona {
  return {
    style: learner.preferredStyle,
    pace: learner.pace,
    difficulty: adaptLearner(learner).difficulty,
  };
}

const VISUAL_START: HomeworkTask = {
  text: "Start visual: draw a quick diagram or picture for this topic first",
  textBn: "আগে ছবি এঁকে শুরু করো: টপিকটির একটি চিত্র আঁকো",
  done: false,
};
const EXAMPLE_START: HomeworkTask = {
  text: "First look at one worked example in your book (5 minutes)",
  textBn: "আগে বইয়ের একটি করে-দেখানো উদাহরণ দেখো (৫ মিনিট)",
  done: false,
};
const STRETCH_TASK: HomeworkTask = {
  text: "Stretch: invent a harder version of this work and solve it",
  textBn: "চ্যালেঞ্জ: নিজে কঠিন একটি সংস্করণ বানিয়ে সমাধান করো",
  done: false,
};

/** Shapes a checklist for a persona: framing by style, volume by pace. */
export function shapeTasksForPersona(
  tasks: HomeworkTask[],
  persona?: HomeworkPersona,
): HomeworkTask[] {
  if (!persona) return tasks;
  let out = [...tasks];
  if (persona.style === "visual") out = [VISUAL_START, ...out];
  if (persona.style === "examples-first") out = [EXAMPLE_START, ...out];
  if (persona.pace === "slow") out = out.slice(0, Math.max(2, out.length - 2));
  if (persona.pace === "fast" || persona.style === "challenge") {
    if (!out.some((t) => t.text.startsWith("Stretch:"))) out = [...out, STRETCH_TASK];
  }
  return out;
}

function instructionsFor(
  ctx: TopicContext,
  seed: string,
  difficulty: 1 | 2 | 3 = 2,
): { en: string; bn: string } {
  const r = createRng(seed);
  const t = ctx.topic;
  switch (t.id.replace(/^c\d+-/, "")) {
    case "math-equations": {
      const eq = () => {
        const x = randInt(r, 2, difficulty === 3 ? 18 : difficulty === 1 ? 9 : 12);
        const a = randInt(r, 2, difficulty === 1 ? 4 : 6);
        const b = randInt(r, 1, 15);
        const neg = r() < 0.5;
        return `${a}x ${neg ? "−" : "+"} ${b} = ${a * x + (neg ? -b : b)}`;
      };
      const [e1, e2] = [eq(), eq()];
      return {
        en: `Solve: ${e1}, ${e2}. Verify each answer by putting x back into the equation.`,
        bn: `সমাধান করো: ${e1}, ${e2}। প্রতিটি উত্তর সমীকরণে বসিয়ে যাচাই করো।`,
      };
    }
    case "math-factors": {
      const hi = difficulty === 1 ? 24 : difficulty === 3 ? 60 : 36;
      const pair = () => `${randInt(r, 6, hi)} ও ${randInt(r, 6, hi)}`;
      return {
        en: `Find the LCM and HCF of (${pair()}) and (${pair()}). Show the factor lists you used.`,
        bn: `(${pair()}) এবং (${pair()})-এর ল.সা.গু ও গ.সা.গু বের করো। গুণনীয়কের তালিকা দেখাও।`,
      };
    }
    case "math-fractions":
      return {
        en: "Add or subtract: 1/2 + 1/4, 2/3 − 1/6, 3/4 + 1/8. Write every answer in simplest form.",
        bn: "যোগ বা বিয়োগ করো: 1/2 + 1/4, 2/3 − 1/6, 3/4 + 1/8। উত্তর সর্বনিম্ন রূপে লেখো।",
      };
    case "math-algebraic": {
      const x = randInt(r, 2, 9);
      return {
        en: `If x = ${x}, find the value of 3x + 5 and 2x − 4. Then write one expression of your own and evaluate it.`,
        bn: `x = ${toBnDigits(x)} হলে 3x + 5 এবং 2x − 4-এর মান বের করো। তারপর নিজে একটি রাশি লিখে মান বের করো।`,
      };
    }
    case "math-angles":
      return {
        en: "In a triangle, two angles are 55° and 65°. Find the third angle, then draw the triangle and label all three angles.",
        bn: "একটি ত্রিভুজের দুটি কোণ ৫৫° ও ৬৫°। তৃতীয় কোণটি বের করো, তারপর ত্রিভুজটি এঁকে তিনটি কোণই চিহ্নিত করো।",
      };
    case "math-area":
      return {
        en: "Find the area and perimeter of a rectangle 12 cm long and 7 cm wide. Draw it first, then calculate.",
        bn: "১২ সেমি লম্বা ও ৭ সেমি চওড়া একটি আয়তের ক্ষেত্রফল ও পরিসীমা বের করো। আগে ছবি আঁকো, তারপর হিসাব করো।",
      };
    default: {
      const terms = t.keyTerms.filter(Boolean).slice(0, 4);
      if (terms.length >= 2) {
        return {
          en: `Write 5 sentences using these words from "${t.title}": ${terms.join(", ")}. Underline each key word.`,
          bn: `"${t.titleBn}"-এর এই শব্দগুলো ব্যবহার করে ৫টি বাক্য লেখো: ${terms.join(", ")}। প্রতিটি মূল শব্দের নিচে দাগ দাও।`,
        };
      }
      return {
        en: `In your notebook, explain in 5–6 lines: ${t.objective}`,
        bn: `খাতায় ৫–৬ লাইনে নিজের ভাষায় লেখো: ${t.objective}`,
      };
    }
  }
}

/* ---------------- sub-task checklists ---------------- */

const task = (text: string, textBn: string): HomeworkTask => ({ text, textBn, done: false });

/** Breaks an assignment into tickable steps (same family switch as instructions). */
function tasksFor(ctx: TopicContext, seed: string): HomeworkTask[] {
  const r = createRng(`${seed}|tasks`);
  const t = ctx.topic;
  switch (t.id.replace(/^c\d+-/, "")) {
    case "math-equations": {
      const eq = () => {
        const x = randInt(r, 2, 12);
        const a = randInt(r, 2, 6);
        const b = randInt(r, 1, 15);
        const neg = r() < 0.5;
        return `${a}x ${neg ? "−" : "+"} ${b} = ${a * x + (neg ? -b : b)}`;
      };
      const [e1, e2] = [eq(), eq()];
      return [
        task(`Solve ${e1}`, `${e1} সমাধান করো`),
        task(`Solve ${e2}`, `${e2} সমাধান করো`),
        task("Put each x back into its equation to verify", "প্রতিটি x মান সমীকরণে বসিয়ে যাচাই করো"),
        task("Write one equation of your own and solve it", "নিজে একটি সমীকরণ বানিয়ে সমাধান করো"),
      ];
    }
    case "math-factors":
      return [
        task("Write the factor lists for both pairs", "দুই জোড়ারই গুণনীয়কের তালিকা লেখো"),
        task("Find the LCM of each pair", "প্রতিটি জোড়ার ল.সা.গু বের করো"),
        task("Find the HCF of each pair", "প্রতিটি জোড়ার গ.সা.গু বের করো"),
      ];
    case "math-fractions":
      return [
        task("Do 1/2 + 1/4 and simplify", "1/2 + 1/4 করো, সরল করো"),
        task("Do 2/3 − 1/6 and simplify", "2/3 − 1/6 করো, সরল করো"),
        task("Do 3/4 + 1/8 and simplify", "3/4 + 1/8 করো, সরল করো"),
      ];
    case "math-algebraic":
      return [
        task("Evaluate 3x + 5 for your chosen x", "তোমার বেছে নেওয়া x-এর জন্য 3x + 5 বের করো"),
        task("Evaluate 2x − 4", "2x − 4 বের করো"),
        task("Write your own expression and evaluate it", "নিজের একটি রাশি লিখে মান বের করো"),
      ];
    case "math-angles":
      return [
        task("Find the third angle (show the subtraction)", "তৃতীয় কোণটি বের করো (বিয়োগটা দেখাও)"),
        task("Draw the triangle neatly", "ত্রিভুজটি সুন্দর করে আঁকো"),
        task("Label all three angles", "তিনটি কোণই চিহ্নিত করো"),
      ];
    case "math-area":
      return [
        task("Draw the 12 cm × 7 cm rectangle", "১২ সেমি × ৭ সেমি আয়তটি আঁকো"),
        task("Calculate the area", "ক্ষেত্রফল হিসাব করো"),
        task("Calculate the perimeter", "পরিসীমা হিসাব করো"),
      ];
    case "sci-plants":
      return [
        task("Draw a leaf and label: blade, vein, stalk", "একটি পাতা এঁকে ব্লেড, শিরা ও বোঁটা চিহ্নিত করো"),
        task("Write how the leaf makes food (use: sunlight, water, air)", "পাতা কীভাবে খাবার তৈরি করে লেখো (সূর্যের আলো, পানি, বাতাস ব্যবহার করো)"),
        task("Find one plant near home and note its leaf shape", "বাড়ির কাছে একটি গাছ দেখে পাতার আকার লিখে রাখো"),
      ];
    case "sci-animals":
      return [
        task("List the digestion stages in order: ingestion → digestion → absorption → egestion", "পরিপাকের ধাপগুলো ক্রমে লেখো: গ্রহণ → পরিপাক → শোষণ → বর্জন"),
        task("Write one line on what happens at each stage", "প্রতিটি ধাপে কী হয়, এক লাইন করে লেখো"),
        task("Give one example food and trace its journey", "একটি খাবারের উদাহরণ দিয়ে তার যাত্রা বর্ণনা করো"),
      ];
    case "sci-light":
      return [
        task("Draw a ray diagram: mirror, incoming ray, reflected ray", "রশ্মি চিত্র আঁকো: দর্পণ, আপতিত রশ্মি, প্রতিফলিত রশ্মি"),
        task("Label the normal and both angles", "অভিলম্ব ও দুটি কোণ চিহ্নিত করো"),
        task("Write the two laws of reflection from memory", "মনে করে প্রতিফলনের দুটি সূত্র লেখো"),
      ];
    case "en-tense":
      return [
        task("Write 3 sentences about yesterday (past tense)", "গতকাল নিয়ে ৩টি বাক্য লেখো (past tense)"),
        task("Write 3 sentences about now (present tense)", "এখন নিয়ে ৩টি বাক্য লেখো (present tense)"),
        task("Underline every verb", "প্রতিটি verb-এর নিচে দাগ দাও"),
        task("Read all 6 sentences aloud", "৬টি বাক্যই জোরে পড়ো"),
      ];
    case "en-speech":
      return [
        task("Write 3 sentences of your own", "নিজে ৩টি বাক্য লেখো"),
        task("Label the noun, verb and adjective in each", "প্রতিটিতে noun, verb ও adjective চিহ্নিত করো"),
        task("Add one adverb to each sentence", "প্রতিটি বাক্যে একটি করে adverb যোগ করো"),
      ];
    case "bn-parts":
      return [
        task("Write 3 Bangla sentences", "বাংলায় ৩টি বাক্য লেখো"),
        task("Label বিশেষ্য, সর্বনাম, ক্রিয়া in each", "প্রতিটিতে বিশেষ্য, সর্বনাম, ক্রিয়া চিহ্নিত করো"),
        task("Write one more sentence with an adjective (বিশেষণ)", "বিশেষণ দিয়ে আরও একটি বাক্য লেখো"),
      ];
    case "bgs-liberation":
    case "bgs-language":
      return [
        task("Make a timeline of 4 key events with years", "৪টি মূল ঘটনার সালসহ টাইমলাইন বানাও"),
        task("Write 2 lines on why the most important event matters", "সবচেয়ে গুরুত্বপূর্ণ ঘটনাটি কেন জরুরি, ২ লাইনে লেখো"),
        task("Tell the timeline aloud to someone at home", "বাড়ির কাউকে টাইমলাইনটি শুনিয়ে দাও"),
      ];
    case "ict-parts":
      return [
        task("Draw a computer and label: monitor, CPU, keyboard, mouse", "কম্পিউটার এঁকে মনিটর, CPU, কীবোর্ড, মাউস চিহ্নিত করো"),
        task("Sort your labels into input and output", "লেবেলগুলো input ও output-এ ভাগ করো"),
        task("Write one line: what does the CPU do?", "এক লাইনে লেখো: CPU কী করে?"),
      ];
    case "ict-safety":
      return [
        task("Write 3 rules for a strong password", "শক্তিশালী পাসওয়ার্ডের ৩টি নিয়ম লেখো"),
        task("Invent (but do NOT share) one strong password pattern", "একটি শক্তিশালী পাসওয়ার্ডের ধরন ভাবো (কাউকে বলবে না)"),
        task("List 2 things you will never share online", "অনলাইনে কখনো শেয়ার করবে না, এমন ২টি জিনিস লেখো"),
      ];
    default: {
      const terms = t.keyTerms.filter(Boolean).slice(0, 4);
      if (terms.length >= 2) {
        return [
          task(`Read these words once more: ${terms.join(", ")}`, `শব্দগুলো আরেকবার পড়ো: ${terms.join(", ")}`),
          task("Write the 5 sentences in your notebook", "খাতায় ৫টি বাক্য লেখো"),
          task("Underline each key word", "প্রতিটি মূল শব্দের নিচে দাগ দাও"),
          task("Read your sentences aloud once", "বাক্যগুলো একবার জোরে পড়ো"),
        ];
      }
      return [
        task("Re-read the lesson goal", "লেসনের লক্ষ্যটি আরেকবার পড়ো"),
        task("Write the explanation in 5–6 lines", "৫–৬ লাইনে ব্যাখ্যাটি লেখো"),
        task("Read it aloud and fix any unclear line", "জোরে পড়ো, অস্পষ্ট লাইন ঠিক করো"),
      ];
    }
  }
}

export function estimateMinutes(tasks: HomeworkTask[]): number {
  return Math.min(30, 5 + tasks.length * 5);
}

/** Checklist progress for one assignment. */
export function taskProgress(a: HomeworkAssignment): { done: number; total: number } {
  return { done: a.tasks.filter((t) => t.done).length, total: a.tasks.length };
}

/**
 * Toggles one sub-task. Status derives from the checklist when tasks
 * exist: all ticked → done; any unticked → back to assigned.
 */
export function toggleTask(
  a: HomeworkAssignment,
  index: number,
  now: Date = new Date(),
): HomeworkAssignment {
  const tasks = a.tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  return {
    ...a,
    tasks,
    status: allDone ? "done" : "assigned",
    completedAt: allDone ? now.toISOString() : null,
  };
}

let idCounter = 0;
export function newHomeworkId(now: Date = new Date()): string {
  idCounter += 1;
  return `hw-${now.getTime().toString(36)}-${idCounter.toString(36)}`;
}

export interface GenerateArgs {
  classLevel: number;
  topicId: string;
  dueBucket: DueBucket;
  source: HomeworkAssignment["source"];
  now: Date;
  recurrence?: HomeworkAssignment["recurrence"];
  /** Shapes volume, framing, and number ranges to the learner. */
  persona?: HomeworkPersona;
}

export function generateHomeworkFromTopic(args: GenerateArgs): HomeworkAssignment {
  // Catalog ids are class-prefixed (c6-math-equations); accept bare keys too.
  const found =
    findTopic(args.classLevel, args.topicId) ??
    findTopic(args.classLevel, `c${args.classLevel}-${args.topicId}`);
  if (!found) throw new Error(`No topic ${args.topicId} for class ${args.classLevel}`);
  const ctx: TopicContext = {
    subjectId: found.subject.id,
    subjectTitle: found.subject.title,
    topic: found.topic,
  };
  const seed = `${args.topicId}|${args.now.toDateString()}|${args.source}`;
  const { en, bn } = instructionsFor(ctx, seed, args.persona?.difficulty ?? 2);
  const tasks = shapeTasksForPersona(tasksFor(ctx, seed), args.persona);
  return HomeworkAssignmentSchema.parse({
    id: newHomeworkId(args.now),
    title: en,
    titleBn: bn,
    subjectId: ctx.subjectId,
    subjectTitle: ctx.subjectTitle,
    topicId: found.topic.id,
    topicTitle: found.topic.title,
    instructions: en,
    instructionsBn: bn,
    tasks,
    estMinutes: estimateMinutes(tasks),
    recurrence: args.recurrence ?? "none",
    source: args.source,
    dueBucket: args.dueBucket,
    dueAt: dueAtForBucket(args.dueBucket, args.now).toISOString(),
    status: "assigned",
    createdAt: args.now.toISOString(),
    completedAt: null,
  });
}

/**
 * Review homework from the learner's observed mistake topics: revisit
 * the first tricky topic, then prove it with a short practice set.
 * Returns null when no mistake topic resolves in the catalog.
 */
export function generateReviewHomework(
  classLevel: number,
  mistakeTopicIds: string[],
  now: Date,
  persona?: HomeworkPersona,
): HomeworkAssignment | null {
  for (const topicId of mistakeTopicIds) {
    const found =
      findTopic(classLevel, topicId) ?? findTopic(classLevel, `c${classLevel}-${topicId}`);
    if (!found) continue;
    const tasks = shapeTasksForPersona(
      [
        task(`Re-read your lesson notes on ${found.topic.title}`, `${found.topic.titleBn} লেসনের নোট আবার পড়ো`),
        task("Write the key steps in your own words", "মূল ধাপগুলো নিজের ভাষায় লেখো"),
        task(`Finish a 5-question practice set on ${found.topic.title}`, `${found.topic.titleBn}-এ ৫ প্রশ্নের অনুশীলন সেট শেষ করো`),
      ],
      persona,
    );
    return HomeworkAssignmentSchema.parse({
      id: newHomeworkId(now),
      title: `Revise: ${found.topic.title}`,
      titleBn: `আবার পড়ো: ${found.topic.titleBn}`,
      subjectId: found.subject.id,
      subjectTitle: found.subject.title,
      topicId: found.topic.id,
      topicTitle: found.topic.title,
      instructions: `This topic tripped you up recently. Revisit it tonight, then prove it with practice: ${found.topic.objective}`,
      instructionsBn: `এই টপিকে সম্প্রতি একটু আটকেছিলে। আজ রাতে আবার পড়ো, তারপর অনুশীলন দিয়ে প্রমাণ করো: ${found.topic.objective}`,
      tasks,
      estMinutes: estimateMinutes(tasks),
      source: "practice",
      dueBucket: "tomorrow",
      dueAt: dueAtForBucket("tomorrow", now).toISOString(),
      status: "assigned",
      createdAt: now.toISOString(),
      completedAt: null,
    });
  }
  return null;
}

/**
 * First-run assignments (the previous static list, as real records):
 * equations tonight, English sentences tomorrow, plant cell Friday.
 */
export function starterAssignments(now: Date, classLevel = 6): HomeworkAssignment[] {
  const mk = (topicId: string, dueBucket: DueBucket): HomeworkAssignment =>
    generateHomeworkFromTopic({ classLevel, topicId, dueBucket, source: "starter", now });
  const list = [mk("math-equations", "tonight"), mk("en-tense", "tomorrow"), mk("sci-plants", "friday")];
  // The plant-cell starter is a drawing task, matching the old static copy.
  const plants = list[2]!;
  return [
    list[0]!,
    list[1]!,
    {
      ...plants,
      title: "Draw and label a plant cell",
      titleBn: "উদ্ভিদ কোষ এঁকে অংশগুলো চিহ্নিত করো",
      instructions:
        "Draw a plant cell and label: cell wall, nucleus, chloroplast, vacuole. Write one line on what each part does.",
      instructionsBn:
        "একটি উদ্ভিদ কোষ আঁকো এবং অংশগুলো চিহ্নিত করো: কোষপ্রাচীর, নিউক্লিয়াস, ক্লোরোপ্লাস্ট, ভ্যাকুওল। প্রতিটি অংশের কাজ এক লাইনে লেখো।",
    },
  ];
}

/** Legacy `kupi-homework` was a bare boolean[] over the static list. */
export function migrateLegacyDoneFlags(
  starters: HomeworkAssignment[],
  flags: boolean[],
  now: Date,
): HomeworkAssignment[] {
  return starters.map((a, i) =>
    flags[i] ? { ...a, status: "done" as const, completedAt: now.toISOString() } : a,
  );
}

/* ---------------- recurrence & points ---------------- */

/**
 * The next occurrence of a recurring assignment, spawned when the
 * current one is completed: same work, fresh checklist, due one
 * day (daily) or one week (weekly) after the current due time.
 */
export function nextOccurrence(a: HomeworkAssignment, now: Date = new Date()): HomeworkAssignment | null {
  if (a.recurrence === "none" || a.status !== "done") return null;
  const due = new Date(a.dueAt);
  due.setDate(due.getDate() + (a.recurrence === "daily" ? 1 : 7));
  return {
    ...a,
    id: newHomeworkId(now),
    tasks: a.tasks.map((t) => ({ ...t, done: false })),
    status: "assigned",
    createdAt: now.toISOString(),
    completedAt: null,
    dueAt: due.toISOString(),
  };
}

export const POINTS_PER_TASK = 5;
export const POINTS_PER_ASSIGNMENT = 10;
export const WEEKLY_GOAL_POINTS = 100;

/** Effort points earned: ticked steps now, full set on completion. */
export function pointsFor(a: HomeworkAssignment): number {
  if (a.tasks.length > 0) return a.tasks.filter((t) => t.done).length * POINTS_PER_TASK;
  return a.status === "done" ? POINTS_PER_ASSIGNMENT : 0;
}

export function totalPoints(list: HomeworkAssignment[]): number {
  return list.reduce((sum, a) => sum + pointsFor(a), 0);
}

/** Points from assignments completed within the current Mon–Sun week. */
export function pointsThisWeek(list: HomeworkAssignment[], now: Date): number {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return list
    .filter((a) => {
      if (!a.completedAt) return false;
      const at = new Date(a.completedAt).getTime();
      return at >= monday.getTime() && at < nextMonday.getTime();
    })
    .reduce((sum, a) => sum + pointsFor(a), 0);
}

/** Overdue pending assignments — drives reminder nudges. */
export function overdueCount(list: HomeworkAssignment[], now: Date): number {
  return list.filter((a) => isOverdue(a, now)).length;
}

/** Pushes the due time out (default: one day). Bucket becomes "custom". */
export function snoozeAssignment(a: HomeworkAssignment, days = 1): HomeworkAssignment {
  const due = new Date(a.dueAt);
  due.setDate(due.getDate() + days);
  return { ...a, dueAt: due.toISOString(), dueBucket: "custom" };
}

export function markDone(
  a: HomeworkAssignment,
  done: boolean,
  now: Date = new Date(),
): HomeworkAssignment {
  // Marking done ticks every sub-task; undoing clears the ticks.
  const tasks = a.tasks.map((t) => ({ ...t, done }));
  return done
    ? { ...a, tasks, status: "done", completedAt: now.toISOString() }
    : { ...a, tasks, status: "assigned", completedAt: null };
}
