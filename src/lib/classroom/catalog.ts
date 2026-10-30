import type { ClassroomRegistry } from "./types";
import { validateRegistry } from "./registry";

/** Customizable persona cards for the Classroom setup screen. */
export type Gender = "male" | "female";
export interface TeacherCard {
  gender: Gender;
  id: string;
  name: string;
  nameBn: string;
  style: "socratic" | "direct" | "analogical" | "visual";
  styleLabel: string;
  trait: string;
  color: string;
  /** Spoken with browser speechSynthesis when the student taps Preview. */
  previewLine: string;
  voice: string;
}
export interface ClassmateCard {
  gender: Gender;
  id: string;
  name: string;
  personality: string;
  habit: string;
  color: string;
  misconception: string;
  reasoning: string;
  partialUpdate: string;
}

export const TEACHERS: TeacherCard[] = [
  {
    id: "rakib", gender: "male", name: "Rakib Sir", nameBn: "রাকিব স্যার", style: "analogical",
    styleLabel: "Real-life examples & stories",
    trait: "Energetic, friendly, humorous · storytelling with bazaar & cricket examples",
    color: "bg-flame text-night",
    previewLine: "Assalamu alaikum! I am Rakib Sir. Maths is hiding in your market, your cricket game, everywhere. Let us find it together, with a story first!",
    voice: "Energetic male voice · faster pace · cheerful, rising tone",
  },
  {
    id: "nasrin", gender: "female", name: "Nasrin Ma'am", nameBn: "নাসরিন ম্যাম", style: "socratic",
    styleLabel: "Detailed step-by-step",
    trait: "Calm, patient, supportive · never rushes, one small step at a time",
    color: "bg-coral text-white",
    previewLine: "Hello, I am Nasrin Ma'am. Do not worry if a sum looks hard. We will take it one small step at a time, together, until it feels easy.",
    voice: "Calm female voice · slow pace · soft, steady tone",
  },
  { id: "arif", gender: "male", name: "Arif Sir", nameBn: "আরিফ স্যার", style: "direct", styleLabel: "Clear & direct", trait: "Fast · short, clear steps", color: "bg-lagoon text-white", previewLine: "I am Arif Sir. Short steps, clear board work, quick checks.", voice: "Direct male voice · steady pace" },
  { id: "farhana", gender: "female", name: "Farhana Mam", nameBn: "ফারহানা ম্যাম", style: "visual", styleLabel: "Draws everything", trait: "Visual · diagrams on the board", color: "bg-brand-500 text-white", previewLine: "I am Farhana Mam. If we can draw it, we can understand it.", voice: "Warm female voice · visual, descriptive" },
];

/** The two teachers shown for the NCTB Mathematics classroom. */
export const MATH_TEACHERS = TEACHERS.filter((t) => t.id === "rakib" || t.id === "nasrin");

export const CLASSMATES: ClassmateCard[] = [
  { id: "tamim", gender: "male", name: "Tamim", personality: "The Curious Student", habit: "Frequently asks why and how, challenges explanations, requests more examples", color: "bg-marigold text-ink", misconception: "Moving a term across = keeps its sign the same.", reasoning: "I move numbers without changing sign.", partialUpdate: "Oh — I have to undo it on both sides?" },
  { id: "nabil", gender: "male", name: "Nabil", personality: "The Struggling Student", habit: "Sometimes misunderstands, makes realistic mistakes, asks the teacher to explain again", color: "bg-lagoon-soft text-padma-ink", misconception: "Bigger denominator means a bigger fraction.", reasoning: "I compare denominators like whole numbers.", partialUpdate: "Wait — more pieces means each piece is smaller. I think I get it now." },
  { id: "mim", gender: "female", name: "Mim", personality: "The Smart Student", habit: "Understands quickly, gives alternative solutions, helps classmates connect ideas", color: "bg-kolapata-soft text-kolapata", misconception: "Once the answer looks neat, checking is a waste of time.", reasoning: "I stop at the first neat answer and never verify.", partialUpdate: "Actually, checking back caught my slip — here is another way to solve it." },
  { id: "priya", gender: "female", name: "Priya", personality: "Careful checker", habit: "Challenges answers politely", color: "bg-lagoon-soft text-padma-ink", misconception: "The coefficient just disappears when x is alone.", reasoning: "I drop the coefficient instead of dividing.", partialUpdate: "So I divide both sides by the coefficient?" },
  { id: "sakib", gender: "male", name: "Sakib", personality: "Methodical", habit: "Follows steps, skips checking", color: "bg-kolapata-soft text-kolapata", misconception: "Once the answer looks neat, checking is a waste of time.", reasoning: "I stop at the first neat answer.", partialUpdate: "Checking back actually caught my slip!" },
  { id: "nabila", gender: "female", name: "Nabila", personality: "Playful", habit: "Guesses fast, laughs, retries", color: "bg-coral-soft text-shapla-ink", misconception: "= means 'write the answer next'.", reasoning: "I read = as an instruction, not a balance.", partialUpdate: "So = is a balance — both sides stay equal?" },
  { id: "hridoy", gender: "male", name: "Hridoy", personality: "Quiet thinker", habit: "Thinks aloud slowly", color: "bg-brand-50 text-brand-700", misconception: "Bigger denominator means a bigger fraction.", reasoning: "I compare denominators like whole numbers.", partialUpdate: "More pieces means each piece is smaller!" },
  { id: "sumaiya", gender: "female", name: "Sumaiya", personality: "Encourager", habit: "Cheers everyone on", color: "bg-marigold-soft text-ember-ink", misconception: "Plants eat soil as their food.", reasoning: "I think food only comes from the ground.", partialUpdate: "Plants make their own food with sunlight?" },
];

export function buildRegistry(input: {
  teacherId: string;
  classmateIds: string[];
  classLevel: number;
  subject: string;
  topicTitle: string;
}): ClassroomRegistry {
  const teacher = TEACHERS.find((t) => t.id === input.teacherId) ?? TEACHERS[0]!;
  const mates = CLASSMATES.filter((c) => input.classmateIds.includes(c.id)).slice(0, 4);
  const registry: ClassroomRegistry = {
    classroom_id: `kupi-${Date.now()}`,
    subject: input.subject,
    class_level: input.classLevel,
    local_context: "Bangladesh daily life",
    task_schema: {
      problem_statement: `Learn and discuss: ${input.topicTitle}.`,
      solution_path: ["Understand the idea", "Work one example", "Check understanding"],
      correct_answer: "Explained step by step in class",
      key_terms: [input.topicTitle],
    },
    agents: [
      {
        agent_id: `teacher_${teacher.id}`,
        role: "teacher",
        display_name: teacher.name,
        persona_traits: { warmth: 0.85, pace: "moderate", explanation_style: teacher.style, humor: 0.25 },
        voice_id: `mock_teacher_${teacher.id}_en`,
        expertise: [input.subject],
        speaking_priority: 10,
        can_draw_whiteboard: true,
        can_make_mistakes: false,
      },
      ...mates.map((m, i) => ({
        agent_id: `classmate_${m.id}`,
        role: "classmate" as const,
        display_name: m.name,
        persona_traits: { proficiency: 0.55, curiosity: 0.8, confidence: 0.5, misconception_bias: ["classroom"] },
        voice_id: `mock_child_${m.id}_en`,
        expertise: [] as string[],
        speaking_priority: 5 - (i % 2),
        can_draw_whiteboard: false,
        can_make_mistakes: true,
        persona_state: {
          misconception_id: `mis_${m.id}`,
          misconception_statement: m.misconception,
          confidence: 0.55,
          reasoning_pattern: m.reasoning,
          partial_update_statement: m.partialUpdate,
        },
      })),
    ],
  };
  const issues = validateRegistry(registry);
  if (issues.length) throw new Error(`Invalid classroom: ${issues.join("; ")}`);
  return registry;
}


/** The three classmates shown for the NCTB Mathematics classroom. */
export const MATH_CLASSMATES = CLASSMATES.filter((c) => ["tamim", "nabil", "mim"].includes(c.id));
