import { findTopic, getClass } from "../nctb/catalog";
import { adaptLearner, type Adaptation, type LearnerProfile } from "../learner/adapt";
import type { LessonQuestion, VizInstruction } from "../lesson/engine";

/**
 * Learning-engine adapter contracts (Step 01).
 *
 * These interfaces are the ONLY way future game steps should reach the
 * curriculum, lesson, learner, persona, visualization, and progress
 * systems — games never import those engines directly. Concrete
 * adapters below wrap the existing modules; they add no behaviour.
 * Learner adaptation is session-only: an adapter computes an
 * adaptation from a profile handed to it and stores nothing.
 */

export interface CurriculumTopicRef {
  classLevel: number;
  subjectId: string;
  chapterId: string;
  topicId: string;
  title: string;
}

export interface CurriculumAdapter {
  findTopic(classLevel: number, topicId: string): CurriculumTopicRef | null;
  classExists(classLevel: number): boolean;
}

export function createNctbCurriculumAdapter(): CurriculumAdapter {
  return {
    findTopic(classLevel, topicId) {
      const found = findTopic(classLevel, topicId);
      if (!found) return null;
      return {
        classLevel,
        subjectId: found.subject.id,
        chapterId: found.chapter.id,
        topicId: found.topic.id,
        title: found.topic.title,
      };
    },
    classExists: (classLevel) => getClass(classLevel) !== null,
  };
}

export interface LessonContextAdapter {
  /** Existing lesson questions for a topic (content source, never generated here). */
  questionsFor(classLevel: number, topicId: string): Promise<LessonQuestion[]>;
}

export interface LearnerPreferenceAdapter {
  /** Session-only adaptation from observable signals. Persists nothing. */
  adaptationFor(profile: LearnerProfile): Adaptation;
}

export function createLearnerPreferenceAdapter(): LearnerPreferenceAdapter {
  return { adaptationFor: (profile) => adaptLearner(profile) };
}

/** Prompt-building personas live in lib/classroom/personas (Step 04 wires them). */
export interface PersonaPromptAdapter {
  buildTeacherPrompt(args: Parameters<typeof import("../classroom/personas").buildTeacherPrompt>[0]): { prompt: string };
  buildClassmatePrompt(args: Parameters<typeof import("../classroom/personas").buildClassmatePrompt>[0]): { prompt: string };
}

export interface VisualizationAdapter {
  /** Visualization instructions are produced by the lesson/viz engine, not games. */
  describe(instruction: VizInstruction): string;
}

export function createVisualizationAdapter(): VisualizationAdapter {
  return { describe: (instruction) => instruction.kind };
}

export interface LearningProgressAdapter {
  /** Record a finished game session's outcome. Implementations decide storage. */
  recordGameResult(input: { learnerRef: string; gameId: string; correct: number; answered: number }): Promise<void>;
  /** Weak NCTB topic ids for this learner, when the progress service knows them. */
  weakTopicIds(learnerRef: string): Promise<string[]>;
}

/**
 * Session-only default: keeps nothing after the call returns. Real
 * persistence (Revision Engine) is wired in a later step behind the
 * existing privacy/legal gate — never by a game directly.
 */
export function createSessionOnlyProgressAdapter(): LearningProgressAdapter {
  return {
    async recordGameResult() {
      /* Deliberately no-op in Step 01: no persistent learner analytics. */
    },
    async weakTopicIds() {
      return [];
    },
  };
}
