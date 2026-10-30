import { getClass } from "../nctb/catalog";
import { CLASS6_MATH, mathBookForClass } from "../nctb/math-book";

/**
 * Books shown in the AI Classroom flow: Class -> Book -> Chapter.
 * A "book" is one subject textbook for the selected class.
 *
 * Class 6 Mathematics uses the real uploaded NCTB textbook chapters
 * (transcribed contents/objectives). Every other class/book uses the
 * NCTB-aligned curriculum catalog chapters — labelled as curriculum,
 * never claimed to be verbatim textbook pages.
 */

export interface BookChapter {
  id: string;
  number: number;
  title: string;
  objectives: string[];
  /** Catalog topic used to generate the lesson (non-textbook books). */
  topicId?: string;
  /** Real textbook chapter id (Class 6 Mathematics only). */
  mathChapterId?: string;
  bookPage?: number;
}

export interface Book {
  id: string;
  classLevel: number;
  title: string;
  chapters: BookChapter[];
  sourceLabel: string;
}

export const CLASS_LEVELS = [6, 7, 8, 9, 10] as const;

export function booksForClass(classLevel: number): Book[] {
  const cls = getClass(classLevel);
  if (!cls) return [];
  return cls.subjects.map((subject) => {
    if (classLevel === 6 && subject.id.endsWith("-math")) {
      const book = mathBookForClass(6);
      if (book.available) {
        return {
          id: subject.id,
          classLevel,
          title: subject.title,
          sourceLabel: book.edition,
          chapters: book.chapters.map((c) => ({
            id: c.id,
            number: c.number,
            title: c.title,
            objectives: c.objectives,
            mathChapterId: c.id,
            bookPage: c.bookPage,
          })),
        };
      }
    }
    return {
      id: subject.id,
      classLevel,
      title: subject.title,
      sourceLabel: `NCTB curriculum · Class ${classLevel}`,
      chapters: subject.chapters.map((c, i) => ({
        id: c.id,
        number: i + 1,
        title: c.title,
        objectives: c.topics.map((t) => t.objective),
        topicId: c.topics[0]?.id,
      })),
    };
  });
}

export function findBook(classLevel: number, bookId: string): Book | null {
  return booksForClass(classLevel).find((b) => b.id === bookId) ?? null;
}

export function findChapter(classLevel: number, bookId: string, chapterId: string): BookChapter | null {
  return findBook(classLevel, bookId)?.chapters.find((c) => c.id === chapterId) ?? null;
}

export { CLASS6_MATH };
