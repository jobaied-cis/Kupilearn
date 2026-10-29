import { z } from "zod";
import {
  EngineException,
  MicroLessonSchema,
  RemediationSchema,
  TeachingScriptSchema,
} from "./types";

/* ------------------------------------------------------------------ */
/* LLM interface. The engine only depends on `LLMClient`, so providers */
/* (and deterministic test doubles) are interchangeable.               */
/* ------------------------------------------------------------------ */

export interface LLMClient {
  /** Generates text and parses it against `schema`; throws LLMError on failure. */
  generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T>;
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

function parseOrThrow<T>(raw: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LLMError("Model did not return valid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new LLMError(`Model output failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Generic HTTP client (BYO provider): POST {prompt} to LLM_API_URL, expects
 * {text} or {content} holding a JSON string. Configure via env.
 */
export class HttpLLMClient implements LLMClient {
  async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const url = process.env.LLM_API_URL;
    if (!url) throw new LLMError("Missing env var LLM_API_URL");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.LLM_API_KEY) headers.authorization = `Bearer ${process.env.LLM_API_KEY}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ prompt }) });
    if (!res.ok) throw new LLMError(`LLM request failed: ${res.status}`);
    const data = (await res.json()) as { text?: string; content?: string };
    const raw = data.text ?? data.content;
    if (typeof raw !== "string") throw new LLMError("LLM response missing text/content");
    return parseOrThrow(raw, schema);
  }
}

/* ------------------------------------------------------------------ */
/* Mock client — deterministic fixtures for dev, tests, and demos.     */
/* Routes on the [TEMPLATE:X] marker the prompt builders embed.        */
/* ------------------------------------------------------------------ */

export class MockLLMClient implements LLMClient {
  calls: string[] = [];

  async generateJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    this.calls.push(prompt);
    const marker = /\[TEMPLATE:([A-Z_]+)\]/.exec(prompt)?.[1] ?? "A";
    if (
      marker === "CLASSMATE" ||
      marker === "TEACHER" ||
      marker === "ASSISTANT" ||
      marker === "DIRECTOR"
    ) {
      return parseOrThrow(JSON.stringify(mockClassroomFixture(marker, prompt)), schema);
    }
    const concept =
      /Target Concept: (.+)/.exec(prompt)?.[1]?.trim() ??
      /Concepts: (.+)/.exec(prompt)?.[1]?.trim() ??
      "the concept";
    const excerpt = /NCERT Excerpt: """([\s\S]*?)"""/.exec(prompt)?.[1]?.trim() ?? "";
    const fixture =
      marker === "A"
        ? mockMicroLesson(concept, excerpt)
        : marker === "B"
          ? mockTeachingScript(concept, excerpt)
          : mockRemediation(prompt);
    return parseOrThrow(JSON.stringify(fixture), schema);
  }
}

function excerptSentences(excerpt: string): string[] {
  return excerpt
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mockMicroLesson(concept: string, excerpt: string): z.infer<typeof MicroLessonSchema> {
  const [s0 = "", s1 = s0, s2 = s0, s3 = s0] = excerptSentences(excerpt);
  const generic = [
    `Why does ${concept} matter? Look around your home and you will see it.`,
    `${concept}: plants use sunlight, water and air to make food for growth.`,
    `Example: a money plant near your window turns sunlight into food daily.`,
    `Mistake: thinking plants eat soil. They make food; soil gives water only.`,
    `Today: rub a leaf, test starch with iodine, and note what you observe.`,
  ];
  const grounded = [
    `Why ${concept}? ${s0}`,
    `${concept}: ${s1}`,
    `Example: ${s2}`,
    `Common mistake, corrected: ${s3}`,
    `Today: reread ${concept} and explain it aloud in one minute.`,
  ];
  const texts = (excerpt ? grounded : generic).map((t) => t.slice(0, 160));
  const types = ["hook", "core", "example", "misconception", "takeaway"] as const;
  return { messages: texts.map((text, i) => ({ seq: i + 1, type: types[i], text })) };
}

function mockTeachingScript(concept: string, excerpt: string): z.infer<typeof TeachingScriptSchema> {
  const section = (title: string, durationMin: number, body: string) => ({
    title,
    durationMin,
    body,
  });
  const sentences = excerptSentences(excerpt);
  if (sentences.length === 0) {
    return {
      sections: [
        section("Prerequisite Recap", 5, `Recall prior knowledge before ${concept}. Ask two diagnostic questions.`),
        section("Concept Introduction", 10, `Define ${concept} with a local example.`),
        section("Guided Practice", 15, `Solve the textbook example on ${concept} step by step.`),
        section("Independent Check", 8, `Pose one competency-based case-study question on ${concept}.`),
        section("Closure", 2, `Summarize ${concept} in three bullets and assign micro-homework.`),
      ],
    };
  }
  // Ground every section in retrieved textbook sentences, like a well-
  // aligned model draft, so the similarity validator exercises honestly.
  const titles: [string, number][] = [
    ["Prerequisite Recap", 5],
    ["Concept Introduction", 10],
    ["Guided Practice", 15],
    ["Independent Check", 8],
    ["Closure", 2],
  ];
  return {
    sections: titles.map(([title, durationMin], i) =>
      section(title, durationMin, sentences[i % sentences.length] as string),
    ),
  };
}

function mockRemediation(prompt: string): z.infer<typeof RemediationSchema> {
  const missing = /has not mastered "(.+?)"/.exec(prompt)?.[1] ?? "the prerequisite";
  return {
    missingPrerequisite: missing,
    bridgeLesson: {
      paragraphs: [
        `${missing} means the food materials plants need to grow and stay healthy.`,
        `Without ${missing}, the next topic will not make sense, so master this bridge first.`,
        `Self-check: name one thing a plant takes from soil and one from air.`,
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Classroom fixtures (§3 / §4): deterministic agent utterances and     */
/* director decisions. Shapes mirror the classroom schemas structurally */
/* (validated against the caller's schema); the mock stays character-   */
/* faithful — classmate drafts never leak the correct answer.           */
/* ------------------------------------------------------------------ */

type ClassroomMarker = "CLASSMATE" | "TEACHER" | "ASSISTANT" | "DIRECTOR";

function mockClassroomFixture(marker: ClassroomMarker, prompt: string): unknown {
  if (marker === "DIRECTOR") return mockDirectorDecision(prompt);
  const name = /- Display Name: (.+)/.exec(prompt)?.[1]?.trim() ?? "Peer";
  if (marker === "TEACHER") return mockTeacherUtterance(prompt, name);
  if (marker === "ASSISTANT") return mockAssistantUtterance(prompt, name);
  return mockClassmateUtterance(prompt, name);
}

function mockClassmateUtterance(prompt: string, name: string): unknown {
  const belief =
    /- Belief: (.+)/.exec(prompt)?.[1]?.trim() ?? "my usual approach works here";
  const misconceptionId = /- Misconception ID: (\S+)/.exec(prompt)?.[1]?.trim() ?? null;
  const brief = /- Question Brief: ([A-Z]+)/.exec(prompt)?.[1] ?? "";
  const moveType =
    brief === "RELATED"
      ? "related_mistake"
      : brief === "EXTENSION"
        ? "extension_question"
        : brief === "BOUNDARY"
          ? "clarifying_question"
          : "misconception_exposure";
  const beliefShort = belief.split(/(?<=\.)\s+/)[0] ?? belief;
  const text =
    moveType === "extension_question"
      ? `Nice — but what happens if we change one number in the problem, ${name} wonders? I still think ${beliefShort}`
      : moveType === "clarifying_question"
        ? `Wait, does that definition also cover the edge case I am thinking of? I still think ${beliefShort}`
        : `I still think ${beliefShort} Can you walk me through where that breaks?`;
  return {
    text: text.slice(0, 600),
    move_type: moveType,
    misconception_id: misconceptionId,
    invites_student_response: true,
    whiteboard_actions: [],
  };
}

function mockTeacherUtterance(prompt: string, name: string): unknown {
  const isCheckpoint = /- Checkpoint Turn: (yes|no)/.exec(prompt)?.[1] === "yes";
  if (prompt.includes("[REDIRECT]")) {
    return {
      text: `Let us pause there and look at the problem together. ${name} will walk through the next step with you.`,
      move_type: "redirect",
      misconception_id: null,
      invites_student_response: false,
      whiteboard_actions: [],
    };
  }
  if (isCheckpoint) {
    return {
      text: "Quick check before we move on: can you tell me the next step in your own words? Just a yes or no first — do you feel ready?",
      move_type: "checkpoint",
      misconception_id: null,
      invites_student_response: true,
      whiteboard_actions: [],
    };
  }
  return {
    text: "Think of the equation as a balance scale — whatever you do to one side, you must do to the other. What should we undo first?",
    move_type: "direct_instruction",
    misconception_id: null,
    invites_student_response: true,
    whiteboard_actions: [],
  };
}

function mockAssistantUtterance(prompt: string, name: string): unknown {
  const isWelcome = /- Welcome Turn: (yes|no)/.exec(prompt)?.[1] === "yes";
  return {
    text: isWelcome
      ? `Welcome to class! I am ${name}, and today we will solve problems together with your teacher and classmates.`
      : `Over to you — ${name} has the whiteboard ready for the next step.`,
    move_type: "facilitation",
    misconception_id: null,
    invites_student_response: false,
    whiteboard_actions: [],
  };
}

function mockDirectorDecision(prompt: string): unknown {
  const candidatesLine = /- Candidates: (.+)/.exec(prompt)?.[1]?.trim() ?? "";
  const lastSpeaker = /- Last Speaker: (\S+)/.exec(prompt)?.[1]?.trim() ?? "none";
  const scaffold = Number.parseFloat(/Scaffold: ([\d.]+)/.exec(prompt)?.[1] ?? "1") || 0;
  const candidates: { id: string; priority: number }[] = [];
  for (const match of candidatesLine.matchAll(/(\S+?)\(\w+,p(\d+)\)/g)) {
    candidates.push({ id: match[1] as string, priority: Number(match[2]) });
  }
  candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const pick = candidates.find((c) => c.id !== lastSpeaker) ?? candidates[0];
  return {
    next_speaker: pick?.id ?? "student",
    reason: "llm_selected",
    scaffold_level: Math.max(0, Math.min(1, scaffold)),
    wait_for_student_seconds: 0,
  };
}

export function createLLMClient(): LLMClient {
  const provider = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  if (provider === "mock") return new MockLLMClient();
  if (provider === "http") return new HttpLLMClient();
  throw new EngineException("LLM_PROVIDER_UNKNOWN", "", `Unknown LLM_PROVIDER: ${provider}`);
}
