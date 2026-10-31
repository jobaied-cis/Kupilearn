import { z } from "zod";
import { adaptLearner, type LearnerProfile } from "../learner/adapt";
import { findTopic, getClass, type Topic } from "../nctb/catalog";

/**
 * Practice engine: deterministic, offline question sets per NCTB topic.
 *
 * Questions are generated (seeded RNG), never fetched — the same
 * (topic, difficulty, variant) always produces the same set, so sets are
 * reproducible in tests and shareable. Difficulty comes from the
 * behavior-only learner adaptation (`adaptLearner`): it changes number
 * ranges and distractor closeness, never a label about the learner.
 */

export const PracticeFormatSchema = z.enum(["mcq", "numeric", "true-false", "spot-mistake"]);
export type PracticeFormat = z.infer<typeof PracticeFormatSchema>;

export const PracticeQuestionSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  kind: z.string().min(1),
  /** mcq/true-false/spot-mistake pick an option; numeric types the answer. */
  format: PracticeFormatSchema.default("mcq"),
  question: z.string().min(1).max(400),
  /** Empty for typed (numeric) questions. */
  options: z.array(z.string().min(1).max(160)).max(4),
  /** Index into options for choice formats; 0 (unused) for numeric. */
  answerIndex: z.number().int().min(0).max(3),
  /** Canonical correct answer as text (the numeric value for typed questions). */
  answer: z.string().min(1).max(160),
  hint: z.string().min(1).max(300),
  explanation: z.string().min(1).max(400),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type PracticeQuestion = z.infer<typeof PracticeQuestionSchema>;

export const PracticeSetSchema = z.object({
  id: z.string().min(1),
  classLevel: z.number().int().min(6).max(10),
  topicId: z.string().min(1),
  topicTitle: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  questions: z.array(PracticeQuestionSchema).min(1),
});
export type PracticeSet = z.infer<typeof PracticeSetSchema>;

export const PracticeResultSchema = z.object({
  id: z.string().min(1),
  setId: z.string().min(1),
  classLevel: z.number().int().min(6).max(10),
  topicId: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  total: z.number().int().positive(),
  correct: z.number().int().min(0),
  finishedAt: z.string().min(1),
});
export type PracticeResult = z.infer<typeof PracticeResultSchema>;

export const PRACTICE_SET_SIZE = 5;

/* ---------------- seeded RNG (deterministic per set) ---------------- */

export function createRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (r: () => number, min: number, max: number): number =>
  min + Math.floor(r() * (max - min + 1));

function shuffle<T>(r: () => number, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Number ranges grow with adaptation difficulty. */
function range(difficulty: 1 | 2 | 3): [number, number] {
  return difficulty === 1 ? [2, 12] : difficulty === 2 ? [3, 24] : [6, 48];
}

function distractors(r: () => number, answer: number, difficulty: 1 | 2 | 3): number[] {
  const spread = difficulty === 3 ? 3 : difficulty === 2 ? 5 : 8;
  const out = new Set<number>();
  let guard = 0;
  while (out.size < 3 && guard < 40) {
    guard += 1;
    const delta = randInt(r, 1, spread) * (r() < 0.5 ? -1 : 1);
    const cand = answer + delta;
    if (cand !== answer && cand > 0) out.add(cand);
  }
  // Deterministic fill if the sampled window was too tight.
  for (let d = 1; out.size < 3; d += 1) {
    if (answer + d !== answer) out.add(answer + d);
    if (out.size < 3 && answer - d > 0) out.add(answer - d);
  }
  return [...out].slice(0, 3);
}

interface Built {
  kind: string;
  format: PracticeFormat;
  question: string;
  options: string[];
  answerIndex: number;
  answer: string;
  hint: string;
  explanation: string;
}

type BuilderCtx = { classLevel: number; topic: Topic };
type Builder = (r: () => number, d: 1 | 2 | 3, ctx: BuilderCtx) => Built | null;

function numericQuestion(
  r: () => number,
  kind: string,
  question: string,
  answer: number,
  difficulty: 1 | 2 | 3,
  hint: string,
  explanation: string,
): Built {
  const options = shuffle(r, [answer, ...distractors(r, answer, difficulty)]).map(String);
  return {
    kind,
    format: "mcq",
    question,
    options,
    answerIndex: options.indexOf(String(answer)),
    answer: String(answer),
    hint,
    explanation,
  };
}

/** Parses a typed answer: integers, decimals, or simple fractions ("3/4"). */
export function parseNumericAnswer(text: string): number | null {
  const clean = text.trim().replace(/\s+/g, "");
  if (!clean) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(clean);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** Grades one pick (option index, or typed text for numeric questions). */
export function isCorrectAnswer(q: PracticeQuestion, pick: number | string | null): boolean {
  if (pick === null) return false;
  if (q.format === "numeric") {
    if (typeof pick !== "string") return false;
    const given = parseNumericAnswer(pick);
    const expected = parseNumericAnswer(q.answer);
    return given !== null && expected !== null && Math.abs(given - expected) < 1e-9;
  }
  return pick === q.answerIndex;
}

/* ---------------- topic-family builders (math) ---------------- */

function lcmHcf(r: () => number, d: 1 | 2 | 3): Built {
  const [lo, hi] = range(d);
  const a = randInt(r, lo, hi);
  const b = randInt(r, lo, hi);
  const g = gcd(a, b);
  const lcm = (a / g) * b;
  if (r() < 0.5) {
    return numericQuestion(r, "lcm", `What is the LCM of ${a} and ${b}?`, lcm, d,
      "List multiples of the bigger number and stop at the first one the other number also divides.",
      `Multiples of ${Math.max(a, b)} reach ${lcm}, which ${Math.min(a, b)} also divides. LCM(${a}, ${b}) = ${lcm}.`);
  }
  return numericQuestion(r, "hcf", `What is the HCF of ${a} and ${b}?`, g, d,
    "Think of the biggest number that divides both numbers exactly.",
    `The largest number dividing both ${a} and ${b} is ${g}. HCF(${a}, ${b}) = ${g}.`);
}

function fractionLargest(r: () => number, d: 1 | 2 | 3): Built {
  const denoms = d === 1 ? [2, 3, 4, 5, 6] : d === 2 ? [3, 4, 5, 6, 8] : [4, 5, 6, 8, 9, 10];
  const fracs = new Map<string, number>();
  while (fracs.size < 4) {
    const den = denoms[randInt(r, 0, denoms.length - 1)]!;
    const num = randInt(r, 1, den - 1);
    fracs.set(`${num}/${den}`, num / den);
  }
  const entries = [...fracs.entries()];
  const answer = entries.reduce((best, e) => (e[1] > best[1] ? e : best), entries[0]!);
  const options = shuffle(r, entries.map(([s]) => s));
  return {
    kind: "fraction-compare",
    format: "mcq",
    question: "Which fraction is the largest?",
    options,
    answerIndex: options.indexOf(answer[0]),
    answer: answer[0],
    hint: "Give every fraction the same denominator (or turn them into decimals) before comparing.",
    explanation: `With a common denominator, ${answer[0]} is the biggest of the four.`,
  };
}

function fractionAdd(r: () => number, d: 1 | 2 | 3): Built {
  const pair: [number, number] = d === 1 ? [2, 4] : d === 2 ? [3, 6] : [4, 6];
  const [d1, d2] = [pair[randInt(r, 0, 1)], pair[randInt(r, 0, 1)]].sort((x, y) => x - y) as [number, number];
  const n1 = randInt(r, 1, d1 - 1 || 1);
  const n2 = randInt(r, 1, d2 - 1 || 1);
  const L = (d1 / gcd(d1, d2)) * d2;
  const num = n1 * (L / d1) + n2 * (L / d2);
  const g = gcd(num, L);
  const answer = `${num / g}/${L / g}`;
  const mistakes = new Set<string>([
    `${n1 + n2}/${d1 + d2}`, // adding tops and bottoms (the classic slip)
    `${num}/${L}`, // unsimplified
    `${Math.max(1, num - g)}/${L}`, // off by one numerator share
  ]);
  mistakes.delete(answer);
  const pool = [answer, ...mistakes];
  for (let k = 2; pool.length < 4; k += 1) {
    const extra = `${num + k}/${L}`;
    if (!pool.includes(extra)) pool.push(extra);
  }
  const options = shuffle(r, pool.slice(0, 4));
  return {
    kind: "fraction-add",
    format: "mcq",
    question: `What is ${n1}/${d1} + ${n2}/${d2}?`,
    options,
    answerIndex: options.indexOf(answer),
    answer,
    hint: `First make both denominators ${L}, then add only the tops.`,
    explanation: `${n1}/${d1} + ${n2}/${d2} = ${num}/${L} = ${answer} in simplest form. Never add the denominators.`,
  };
}

function evaluateExpr(r: () => number, d: 1 | 2 | 3): Built {
  const [, hi] = range(d);
  const a = randInt(r, 2, d === 1 ? 6 : 12);
  const b = randInt(r, 1, hi);
  const x = randInt(r, 2, d === 1 ? 9 : 15);
  return numericQuestion(r, "evaluate", `If x = ${x}, what is ${a}x + ${b}?`, a * x + b, d,
    `Replace x by ${x} everywhere, then multiply before you add.`,
    `${a} × ${x} + ${b} = ${a * x} + ${b} = ${a * x + b}.`);
}

function solveEquation(r: () => number, d: 1 | 2 | 3): Built {
  const x = randInt(r, 2, d === 1 ? 9 : d === 2 ? 15 : 20);
  const a = randInt(r, 2, d === 1 ? 5 : 9);
  const b = randInt(r, 1, 20);
  const c = a * x + (r() < 0.5 ? b : -b);
  const sign = c - a * x >= 0 ? "+" : "−";
  const shown = `${a}x ${sign} ${Math.abs(c - a * x)} = ${c}`;
  return numericQuestion(r, "equation", `Solve: ${shown}`, x, d,
    "Undo the last step first: clear the added/subtracted number, then divide both sides.",
    `Balancing both sides leaves ${a}x = ${a * x}, so x = ${x}. Check: ${a} × ${x} ${sign} ${Math.abs(c - a * x)} = ${c}. ✓`);
}

function triangleAngle(r: () => number, d: 1 | 2 | 3): Built {
  const a = randInt(r, 30, 80);
  const b = randInt(r, 30, 160 - a);
  const third = 180 - a - b;
  return numericQuestion(r, "angle", `Two angles of a triangle are ${a}° and ${b}°. What is the third angle?`, third, d,
    "The three angles of any triangle always add up to the same total.",
    `${a}° + ${b}° = ${a + b}°, and 180° − ${a + b}° = ${third}°.`);
}

function areaPerimeter(r: () => number, d: 1 | 2 | 3): Built {
  const [lo, hi] = range(d);
  const l = randInt(r, lo, hi);
  const w = randInt(r, 2, Math.max(3, hi - 2));
  if (r() < 0.5) {
    return numericQuestion(r, "area", `A rectangle is ${l} cm long and ${w} cm wide. What is its area?`, l * w, d,
      "Area counts the squares inside: length × width.",
      `Area = ${l} × ${w} = ${l * w} cm².`);
  }
  return numericQuestion(r, "perimeter", `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter?`, 2 * (l + w), d,
    "Perimeter walks all the way around: add all four sides.",
    `Perimeter = 2 × (${l} + ${w}) = ${2 * (l + w)} cm.`);
}

function fractionSubtract(r: () => number, d: 1 | 2 | 3): Built {
  const denoms = d === 1 ? [2, 3, 4] : d === 2 ? [3, 4, 5, 6] : [4, 5, 6, 8, 9];
  const d1 = denoms[randInt(r, 0, denoms.length - 1)]!;
  const d2 = d1 * [2, 3][randInt(r, 0, 1)]!;
  // Work over the common denominator so the result is always positive.
  const n1 = randInt(r, 1, d1 - 1);
  const scaled = n1 * (d2 / d1); // exact: d2 is a multiple of d1
  const n2 = randInt(r, 1, scaled - 1);
  const L = d2;
  const num = scaled - n2;
  const g = gcd(Math.max(1, num), L);
  const answer = `${num / g}/${L / g}`;
  const mistakes = new Set<string>([`${n1 - n2}/${d1}`, `${num}/${L}`, `${Math.max(1, num - 1)}/${L}`]);
  mistakes.delete(answer);
  const pool = [answer, ...mistakes];
  for (let k = 2; pool.length < 4; k += 1) {
    const extra = `${num + k}/${L}`;
    if (!pool.includes(extra)) pool.push(extra);
  }
  const options = shuffle(r, pool.slice(0, 4));
  return {
    kind: "fraction-subtract",
    format: "mcq",
    question: `What is ${n1}/${d1} − ${n2}/${d2}?`,
    options,
    answerIndex: options.indexOf(answer),
    answer,
    hint: `Make the bottom ${L} first, then subtract only the tops.`,
    explanation: `${n1}/${d1} − ${n2}/${d2} = ${num}/${L} = ${answer} in simplest form.`,
  };
}

function percentOf(r: () => number, d: 1 | 2 | 3): Built {
  const p = [10, 20, 25, 50, 75][randInt(r, 0, 4)]!;
  const base = d === 1 ? [40, 80, 100, 200][randInt(r, 0, 3)]! : [60, 120, 240, 300, 400][randInt(r, 0, 4)]!;
  const answer = (base * p) / 100;
  return numericQuestion(r, "percent", `What is ${p}% of ${base}?`, answer, d,
    `${p}% means ${p} out of every 100. Find 1% first (${base} ÷ 100), then multiply by ${p}.`,
    `${p}% of ${base} = ${base} ÷ 100 × ${p} = ${answer}.`);
}

function meanOf(r: () => number, d: 1 | 2 | 3): Built {
  const mean = randInt(r, 4, d === 1 ? 15 : 30);
  const spread = d === 1 ? 4 : 9;
  const a = mean - randInt(r, 1, spread);
  const b = mean + randInt(r, 0, spread);
  const c = 3 * mean - a - b;
  return numericQuestion(r, "mean", `What is the average (mean) of ${a}, ${b} and ${c}?`, mean, d,
    "Add all three numbers, then share the total equally among 3.",
    `(${a} + ${b} + ${c}) ÷ 3 = ${a + b + c} ÷ 3 = ${mean}.`);
}

function moneyWordProblem(r: () => number, d: 1 | 2 | 3): Built {
  const price = [15, 20, 25, 40, 50][randInt(r, 0, 4)]!;
  const count = randInt(r, 2, d === 1 ? 4 : 8);
  const start = price * count + [10, 20, 30, 50][randInt(r, 0, 3)]!;
  const left = start - price * count;
  return numericQuestion(r, "word-problem",
    `Rafi had ৳${start}. He bought ${count} exercise books at ৳${price} each. How much money is left?`,
    left, d,
    `First find the total cost: ${count} × ৳${price}. Then subtract it from ৳${start}.`,
    `Cost = ${count} × ৳${price} = ৳${price * count}. Left = ৳${start} − ৳${price * count} = ৳${left}.`);
}

function simplifyExpr(r: () => number, d: 1 | 2 | 3): Built {
  const cap = d === 1 ? 5 : d === 2 ? 9 : 12;
  const a = randInt(r, 2, cap);
  const b = randInt(r, 2, cap);
  const sum = `${a + b}x`;
  const options = shuffle(r, [sum, `${a * b}x`, `${a}x + ${b}`, `${a + b}`]);
  return {
    kind: "simplify",
    format: "mcq",
    question: `Simplify: ${a}x + ${b}x`,
    options,
    answerIndex: options.indexOf(sum),
    answer: sum,
    hint: "Terms with the same letter can be joined: count how many x there are in total.",
    explanation: `${a}x + ${b}x has ${a} + ${b} = ${a + b} copies of x, so it is ${sum}.`,
  };
}

const MATH_BUILDERS: Record<string, Builder[]> = {
  "math-factors": [lcmHcf, lcmHcf, fractionAdd, percentOf],
  "math-fractions": [fractionLargest, fractionAdd, fractionLargest, fractionSubtract],
  "math-algebraic": [evaluateExpr, evaluateExpr, solveEquation, simplifyExpr],
  "math-equations": [solveEquation, solveEquation, evaluateExpr, moneyWordProblem],
  "math-angles": [triangleAngle, triangleAngle, areaPerimeter, meanOf],
  "math-area": [areaPerimeter, areaPerimeter, triangleAngle, percentOf],
};

/* ---------------- generic builders (any topic) ---------------- */

function allTopics(classLevel: number): Topic[] {
  return getClass(classLevel)?.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics)) ?? [];
}

function keyTermQuestion(r: () => number, classLevel: number, topic: Topic): Built | null {
  const terms = topic.keyTerms.filter(Boolean);
  if (terms.length === 0) return null;
  const others = allTopics(classLevel)
    .filter((t) => t.id !== topic.id)
    .flatMap((t) => t.keyTerms)
    .filter((term) => term && !terms.includes(term));
  if (others.length < 3) return null;
  const answer = terms[randInt(r, 0, terms.length - 1)]!;
  const options = shuffle(r, [answer, ...shuffle(r, others).slice(0, 3)]);
  return {
    kind: "key-term",
    format: "mcq",
    question: `Which of these is a key term of "${topic.title}"?`,
    options,
    answerIndex: options.indexOf(answer),
    answer,
    hint: `Recall the words your teacher circled while teaching ${topic.title}.`,
    explanation: `"${answer}" is one of the key terms of ${topic.title}.`,
  };
}

function objectiveQuestion(r: () => number, classLevel: number, topic: Topic): Built {
  const others = allTopics(classLevel).filter((t) => t.id !== topic.id && t.objective !== topic.objective);
  const distract = shuffle(r, others).slice(0, 3).map((t) => t.objective);
  const options = shuffle(r, [topic.objective, ...distract]);
  return {
    kind: "objective",
    format: "mcq",
    question: `Which statement best describes what you learn in "${topic.title}"?`,
    options,
    answerIndex: options.indexOf(topic.objective),
    answer: topic.objective,
    hint: `Think about the goal of the lesson: ${topic.title}.`,
    explanation: `In ${topic.title}: ${topic.objective}`,
  };
}

/* ---------------- new formats: typed, true/false, spot-the-mistake ---------------- */

function typedQuestion(kind: string, question: string, answer: string, hint: string, explanation: string): Built {
  return { kind, format: "numeric", question, options: [], answerIndex: 0, answer, hint, explanation };
}

/** Typed-answer questions (write the number — no options to guess from). */
const typedFor = (key: string): Builder => (r, d) => {
  const [lo, hi] = range(d);
  switch (key) {
    case "math-equations":
    case "math-algebraic": {
      const x = randInt(r, 2, d === 1 ? 9 : 15);
      const a = randInt(r, 2, 6);
      const b = randInt(r, 1, 20);
      return typedQuestion("typed-equation", `Solve and type x: ${a}x + ${b} = ${a * x + b}`,
        String(x), "Clear the added number from both sides, then divide by the number with x.",
        `${a}x = ${a * x}, so x = ${x}.`);
    }
    case "math-factors": {
      const a = randInt(r, lo, hi);
      const b = randInt(r, lo, hi);
      const g = gcd(a, b);
      return typedQuestion("typed-lcm", `Type the LCM of ${a} and ${b}.`, String((a / g) * b),
        "List multiples of the bigger number until the smaller one divides it too.",
        `LCM(${a}, ${b}) = ${(a / g) * b}.`);
    }
    case "math-fractions": {
      const den = [2, 3, 4, 6][randInt(r, 0, 3)]!;
      const n1 = randInt(r, 1, den - 1);
      const n2 = randInt(r, 1, den - 1);
      const num = n1 + n2;
      const g = gcd(num, den);
      return typedQuestion("typed-fraction", `Type the answer in simplest form (like 3/4): ${n1}/${den} + ${n2}/${den}`,
        `${num / g}/${den / g}`, "Same denominator — add the tops only, then simplify.",
        `${n1}/${den} + ${n2}/${den} = ${num}/${den} = ${num / g}/${den / g}.`);
    }
    case "math-angles": {
      const a = randInt(r, 30, 80);
      const b = randInt(r, 30, 160 - a);
      return typedQuestion("typed-angle", `Two angles of a triangle are ${a}° and ${b}°. Type the third angle (degrees).`,
        String(180 - a - b), "All three angles of a triangle add up to 180°.",
        `180° − ${a}° − ${b}° = ${180 - a - b}°.`);
    }
    default: {
      const l = randInt(r, lo, hi);
      const w = randInt(r, 2, 12);
      return typedQuestion("typed-area", `Type the area (cm²) of a rectangle ${l} cm by ${w} cm.`,
        String(l * w), "Area = length × width.", `Area = ${l} × ${w} = ${l * w} cm².`);
    }
  }
};

function trueFalseBuilt(claim: string, truth: boolean, hint: string, explanation: string): Built {
  return {
    kind: "true-false",
    format: "true-false",
    question: `True or false: ${claim}`,
    options: ["True", "False"],
    answerIndex: truth ? 0 : 1,
    answer: truth ? "True" : "False",
    hint,
    explanation,
  };
}

const trueFalseMath: Builder = (r, d) => {
  const [lo, hi] = range(d);
  const truth = r() < 0.5;
  if (r() < 0.5) {
    const a = randInt(r, lo, hi);
    const b = randInt(r, lo, hi);
    const g = gcd(a, b);
    const lcm = (a / g) * b;
    const claimValue = truth ? lcm : a * b === lcm ? lcm + b : a * b;
    return trueFalseBuilt(`The LCM of ${a} and ${b} is ${claimValue}.`, truth,
      "Check with multiples: does the smaller number divide the claimed LCM?",
      `LCM(${a}, ${b}) = ${lcm}, so the statement is ${truth ? "true" : "false"}.`);
  }
  const a = randInt(r, 30, 80);
  const b = randInt(r, 30, 160 - a);
  const third = 180 - a - b;
  const claimValue = truth ? third : third + 10;
  return trueFalseBuilt(`A triangle with angles ${a}° and ${b}° has third angle ${claimValue}°.`, truth,
    "The three angles of a triangle always total 180°.",
    `${a}° + ${b}° + ${third}° = 180°, so the statement is ${truth ? "true" : "false"}.`);
};

const trueFalseTerm: Builder = (r, _d, ctx) => {
  const terms = ctx.topic.keyTerms.filter(Boolean);
  if (terms.length === 0) return null;
  const others = allTopics(ctx.classLevel)
    .filter((t) => t.id !== ctx.topic.id)
    .flatMap((t) => t.keyTerms)
    .filter((term) => term && !terms.includes(term));
  if (others.length === 0) return null;
  const truth = r() < 0.5;
  const term = truth
    ? terms[randInt(r, 0, terms.length - 1)]!
    : others[randInt(r, 0, others.length - 1)]!;
  return trueFalseBuilt(`"${term}" is a key term of "${ctx.topic.title}".`, truth,
    `Recall the circled words from the ${ctx.topic.title} lesson.`,
    truth
      ? `Yes — "${term}" is one of the key terms of ${ctx.topic.title}.`
      : `No — "${term}" belongs to a different topic, not ${ctx.topic.title}.`);
};

const oddOneOut: Builder = (r, _d, ctx) => {
  const terms = ctx.topic.keyTerms.filter(Boolean);
  if (terms.length < 3) return null;
  const others = allTopics(ctx.classLevel)
    .filter((t) => t.id !== ctx.topic.id)
    .flatMap((t) => t.keyTerms)
    .filter((term) => term && !terms.includes(term));
  if (others.length === 0) return null;
  const foreign = others[randInt(r, 0, others.length - 1)]!;
  const options = shuffle(r, [...shuffle(r, terms).slice(0, 3), foreign]);
  return {
    kind: "odd-one-out",
    format: "mcq",
    question: `Which of these does NOT belong to "${ctx.topic.title}"?`,
    options,
    answerIndex: options.indexOf(foreign),
    answer: foreign,
    hint: `Three of these were circled in the ${ctx.topic.title} lesson. One was not.`,
    explanation: `"${foreign}" is from a different topic; the other three are key terms of ${ctx.topic.title}.`,
  };
};

/** Worked-solution questions: exactly one step contains the planted error. */
const spotMistake: Builder = (r, d) => {
  const x = randInt(r, 2, d === 1 ? 9 : 15);
  const a = randInt(r, 2, 6);
  const b = randInt(r, 1, 20);
  const c = a * x + b;
  const wrong = x + (r() < 0.5 ? 1 : 2);
  const steps = [
    { text: `Step 1: ${a}x = ${c} − ${b} = ${a * x}`, wrong: false },
    { text: `Step 2: x = ${a * x} ÷ ${a} = ${wrong}`, wrong: true },
    { text: `Step 3 (check): ${a} × ${x} + ${b} = ${c} ✓`, wrong: false },
  ];
  const options = shuffle(r, steps.map((s) => s.text));
  const bad = steps.find((s) => s.wrong)!;
  return {
    kind: "spot-mistake",
    format: "spot-mistake",
    question: `Rafi solved ${a}x + ${b} = ${c}. One step is wrong — which one?`,
    options,
    answerIndex: options.indexOf(bad.text),
    answer: bad.text,
    hint: `Redo each step yourself: subtract ${b} from both sides, then divide by ${a}, then check.`,
    explanation: `Step 2 is wrong: ${a * x} ÷ ${a} = ${x}, not ${wrong}. The correct answer is x = ${x}.`,
  };
};

/* ---------------- set assembly ---------------- */

const keyTermBuilder: Builder = (r, _d, ctx) => keyTermQuestion(r, ctx.classLevel, ctx.topic);
const objectiveBuilder: Builder = (r, _d, ctx) => objectiveQuestion(r, ctx.classLevel, ctx.topic);

/** Candidate builders for a topic, in rotation order (nulls are skipped). */
function candidatesFor(classLevel: number, topic: Topic): Builder[] {
  const key = topic.id.replace(/^c\d+-/, "");
  const math = MATH_BUILDERS[key];
  if (math) {
    const base: Builder[] = [...math, typedFor(key), trueFalseMath];
    if (key === "math-equations" || key === "math-algebraic") base.push(spotMistake);
    return base;
  }
  return [keyTermBuilder, objectiveBuilder, trueFalseTerm, oddOneOut];
}

function buildOne(
  r: () => number,
  classLevel: number,
  topic: Topic,
  difficulty: 1 | 2 | 3,
  startAt: number,
): Built {
  const candidates = candidatesFor(classLevel, topic);
  for (let k = 0; k < candidates.length; k += 1) {
    const built = candidates[(startAt + k) % candidates.length]!(r, difficulty, { classLevel, topic });
    if (built) return built;
  }
  return objectiveQuestion(r, classLevel, topic);
}

function toQuestion(seed: string, index: number, topic: Topic, difficulty: 1 | 2 | 3, built: Built): PracticeQuestion {
  return PracticeQuestionSchema.parse({
    id: `${seed}|q${index}`,
    topicId: topic.id,
    kind: built.kind,
    format: built.format,
    question: built.question,
    options: built.options,
    answerIndex: built.answerIndex,
    answer: built.answer,
    hint: built.hint,
    explanation: built.explanation,
    difficulty,
  });
}

/* ---------------- public API ---------------- */

export function buildPracticeSet(
  classLevel: number,
  topicId: string,
  difficulty: 1 | 2 | 3,
  count = PRACTICE_SET_SIZE,
  variant = 0,
): PracticeSet {
  // Catalog ids are class-prefixed (c6-math-equations); accept bare keys too.
  const found =
    findTopic(classLevel, topicId) ?? findTopic(classLevel, `c${classLevel}-${topicId}`);
  if (!found) throw new Error(`No topic ${topicId} for class ${classLevel}`);
  const { topic } = found;
  const seed = `${topic.id}|d${difficulty}|v${variant}`;
  const r = createRng(seed);
  const questions: PracticeQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    // Rotate by variant so every question kind surfaces across re-practice.
    questions.push(toQuestion(seed, i, topic, difficulty, buildOne(r, classLevel, topic, difficulty, i + variant)));
  }
  return PracticeSetSchema.parse({
    id: seed,
    classLevel,
    topicId: topic.id,
    topicTitle: topic.title,
    difficulty,
    questions,
  });
}

/**
 * Daily Mix: one question from each of several topics, seeded by the
 * calendar day so the whole class gets the same fresh mix each morning.
 */
export function buildMixedPracticeSet(
  learner: LearnerProfile,
  now: Date = new Date(),
  count = PRACTICE_SET_SIZE,
): PracticeSet {
  const difficulty = adaptLearner(learner).difficulty;
  const seed = `mix|d${difficulty}|${now.toDateString()}`;
  const r = createRng(seed);
  const topics = shuffle(r, allTopics(learner.classLevel)).slice(0, count);
  const questions = topics.map((topic, i) =>
    toQuestion(seed, i, topic, difficulty, buildOne(r, learner.classLevel, topic, difficulty, i)),
  );
  return PracticeSetSchema.parse({
    id: seed,
    classLevel: learner.classLevel,
    topicId: "mixed",
    topicTitle: "Daily Mix",
    difficulty,
    questions,
  });
}

/**
 * Mistake Review: questions drawn from the learner's tricky topics —
 * observed mistakes first, then the weakest topics by past accuracy.
 * Returns null when there is nothing to review yet.
 */
export function buildReviewPracticeSet(
  learner: LearnerProfile,
  pastResults: PracticeResult[],
  count = PRACTICE_SET_SIZE,
): PracticeSet | null {
  const topics = allTopics(learner.classLevel);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const candidates: Topic[] = [];
  for (const id of learner.mistakeTopics) {
    const topic = byId.get(id);
    if (topic && !candidates.includes(topic)) candidates.push(topic);
  }
  if (candidates.length < count) {
    const scored = new Map<string, { right: number; total: number }>();
    for (const res of pastResults) {
      const entry = scored.get(res.topicId) ?? { right: 0, total: 0 };
      entry.right += res.correct;
      entry.total += res.total;
      scored.set(res.topicId, entry);
    }
    const weakest = [...scored.entries()]
      .filter(([, s]) => s.total > 0)
      .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
    for (const [id] of weakest) {
      const topic = byId.get(id);
      if (topic && !candidates.includes(topic)) candidates.push(topic);
      if (candidates.length >= count) break;
    }
  }
  if (candidates.length === 0) return null;
  const difficulty = adaptLearner(learner).difficulty;
  const variant = pastResults.filter((r) => r.topicId === "review").length;
  const seed = `review|d${difficulty}|v${variant}`;
  const r = createRng(seed);
  const questions: PracticeQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const topic = candidates[i % candidates.length]!;
    questions.push(toQuestion(seed, i, topic, difficulty, buildOne(r, learner.classLevel, topic, difficulty, i)));
  }
  return PracticeSetSchema.parse({
    id: seed,
    classLevel: learner.classLevel,
    topicId: "review",
    topicTitle: "Mistake Review",
    difficulty,
    questions,
  });
}

/**
 * Adaptive entry point: difficulty from the learner's observed behavior,
 * and the variant advances with past sessions so re-practice varies.
 */
export function buildAdaptivePracticeSet(
  learner: LearnerProfile,
  topicId: string,
  pastResults: PracticeResult[],
): PracticeSet {
  const difficulty = adaptLearner(learner).difficulty;
  // Results carry canonical ids (c6-math-equations); accept bare keys here.
  const variant = pastResults.filter(
    (r) => r.topicId === topicId || r.topicId.endsWith(`-${topicId}`),
  ).length;
  return buildPracticeSet(learner.classLevel, topicId, difficulty, PRACTICE_SET_SIZE, variant);
}

/**
 * Retry set: exactly the questions answered wrong in a finished set —
 * deliberate re-practice of the misses, in the same order.
 */
export function buildRetrySet(set: PracticeSet, picks: (number | string | null)[]): PracticeSet | null {
  const graded = gradePracticeSet(set, picks);
  const wrong = set.questions.filter((_, i) => !graded.correct[i]);
  if (wrong.length === 0) return null;
  return PracticeSetSchema.parse({
    id: `retry|${set.id}`,
    classLevel: set.classLevel,
    topicId: "retry",
    topicTitle: `Retry: ${set.topicTitle}`,
    difficulty: set.difficulty,
    questions: wrong.map((q, i) => ({ ...q, id: `retry|${q.id}|${i}` })),
  });
}

/** A practice set assembled from the learner's bookmarked questions. */
export function buildBookmarkSet(
  learner: LearnerProfile,
  bookmarked: PracticeQuestion[],
): PracticeSet | null {
  if (bookmarked.length === 0) return null;
  const difficulty = adaptLearner(learner).difficulty;
  return PracticeSetSchema.parse({
    id: `bookmarks|d${difficulty}`,
    classLevel: learner.classLevel,
    topicId: "bookmarks",
    topicTitle: "My Bookmarks",
    difficulty,
    questions: bookmarked.slice(0, 10).map((q, i) => ({ ...q, id: `bm|${q.id}|${i}` })),
  });
}

export function gradePracticeSet(
  set: PracticeSet,
  picks: (number | string | null)[],
): { correct: boolean[]; score: number } {
  const correct = set.questions.map((q, i) => isCorrectAnswer(q, picks[i] ?? null));
  return { correct, score: correct.filter(Boolean).length };
}

export function makePracticeResult(
  set: PracticeSet,
  score: number,
  finishedAt: Date = new Date(),
): PracticeResult {
  return PracticeResultSchema.parse({
    id: `${set.id}|${finishedAt.toISOString()}`,
    setId: set.id,
    classLevel: set.classLevel,
    topicId: set.topicId,
    difficulty: set.difficulty,
    total: set.questions.length,
    correct: score,
    finishedAt: finishedAt.toISOString(),
  });
}

export interface PracticeSummary {
  sessions: number;
  questionsAnswered: number;
  correct: number;
  accuracy: number;
}

export function summarizePractice(results: PracticeResult[]): PracticeSummary {
  const total = results.reduce((n, r) => n + r.total, 0);
  const correct = results.reduce((n, r) => n + r.correct, 0);
  return {
    sessions: results.length,
    questionsAnswered: total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
}
