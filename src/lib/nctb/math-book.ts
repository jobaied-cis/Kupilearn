/**
 * NCTB Mathematics, Class Six (English Version), Revised Edition Oct 2025.
 * Transcribed from the uploaded textbook (Book/Math_Book.pdf):
 * - Contents page (book p. iv / PDF p. 5) for chapter titles + page numbers.
 * - Each chapter's first page for its "students will be able to" objectives
 *   and first numbered subtopic.
 * Nothing here is invented: classes/subjects without an uploaded textbook
 * return a missing-source state instead of fabricated chapters.
 */

export interface MathChapter {
  id: string;
  number: number;
  title: string;
  titleBn: string;
  /** Book page where the chapter starts (printed page number). */
  bookPage: number;
  /** Book page where the next chapter starts; chapter ends the page before. */
  endBookPage: number;
  objectives: string[];
  /** Verified first numbered subtopics from the chapter's opening pages. */
  subtopics: { id: string; title: string; bookPage: number }[];
  source: string;
}

const S = "NCTB Mathematics Class Six (English Version), Revised Edition Oct 2025";

export const CLASS6_MATH: { classLevel: 6; subject: "Mathematics"; edition: string; chapters: MathChapter[] } = {
  classLevel: 6,
  subject: "Mathematics",
  edition: S,
  chapters: [
    {
      id: "c6m-ch1", number: 1, title: "Natural Numbers and Fractions", titleBn: "স্বাভাবিক সংখ্যা ও ভগ্নাংশ", bookPage: 1, endBookPage: 44,
      objectives: [
        "Form natural numbers through arithmetic.",
        "Read or write natural numbers in domestic and international style.",
        "Identify prime numbers, composite numbers and co-prime numbers.",
        "Explain divisibility; check divisibility by 2, 3, 4, 5, 9.",
        "Determine GCD and LCM of natural numbers, fractions, and decimal fractions.",
        "Solve mathematical problems by simplifying fractions and decimal fractions.",
      ],
      subtopics: [{ id: "c6m-ch1-1", title: "1.1 Enumeration", bookPage: 1 }],
      source: `${S}, Chapter One, book p. 1`,
    },
    {
      id: "c6m-ch2", number: 2, title: "Ratios and Percentages", titleBn: "অনুপাত ও শতকরা", bookPage: 45, endBookPage: 68,
      objectives: [
        "Explain what ratio is.",
        "Solve the problems related to simple ratio.",
        "Express percentage to fraction and fraction to percentage.",
        "Express ratio to percentage and percentage to ratio.",
        "Describe unitary method and the method of percentage accounting.",
        "Solve arithmetic problems about time and work, time and food, time and distance with the unitary method.",
      ],
      subtopics: [{ id: "c6m-ch2-1", title: "2.1 Ratio", bookPage: 45 }],
      source: `${S}, Chapter Two, book p. 45`,
    },
    {
      id: "c6m-ch3", number: 3, title: "Integers", titleBn: "পূর্ণসংখ্যা", bookPage: 69, endBookPage: 87,
      objectives: [
        "Explain the characteristics of integers.",
        "Identify integers.",
        "Show integers on a number line and compare small and large integers.",
        "Add and subtract signed numbers and represent those on number lines.",
      ],
      subtopics: [{ id: "c6m-ch3-1", title: "3.1 Concept of Negative Integers", bookPage: 69 }],
      source: `${S}, Chapter Three, book p. 69`,
    },
    {
      id: "c6m-ch4", number: 4, title: "Algebraic Expressions", titleBn: "বীজগণিতীয় রাশি", bookPage: 88, endBookPage: 109,
      objectives: [
        "Solve mathematical problems using algebraic symbol, variables, coefficient, index.",
        "Identify the similar and dissimilar terms of algebraic expressions.",
        "Describe algebraic expressions of one or more than one terms.",
        "Do addition and subtraction of algebraic expressions.",
      ],
      subtopics: [{ id: "c6m-ch4-1", title: "4.1 Algebraic Symbols, Variables, Coefficients and Indices", bookPage: 88 }],
      source: `${S}, Chapter Four, book p. 88`,
    },
    {
      id: "c6m-ch5", number: 5, title: "Simple Equations", titleBn: "সরল সমীকরণ", bookPage: 110, endBookPage: 122,
      objectives: [
        "Explain what an equation is.",
        "Explain and solve simple equations.",
        "Form and solve equations based on real life problems.",
      ],
      subtopics: [{ id: "c6m-ch5-1", title: "5.1 Equation", bookPage: 110 }],
      source: `${S}, Chapter Five, book p. 110`,
    },
    {
      id: "c6m-ch6", number: 6, title: "Basic Concepts of Geometry", titleBn: "জ্যামিতির মৌলিক ধারণা", bookPage: 123, endBookPage: 142,
      objectives: [
        "Explain basic concepts of geometry such as space, plane, line, point etc.",
        "Distinguish between straight lines, lengths and rays.",
        "Explain the relationship between different types of angles.",
        "Describe parallel straight lines and angles formed by two parallel lines and an intersection.",
        "Explain different types of triangles (in terms of sides and angles).",
        "Identify different types of quadrilaterals.",
      ],
      subtopics: [{ id: "c6m-ch6-1", title: "6.1 Space, surface, line and point", bookPage: 123 }],
      source: `${S}, Chapter Six, book p. 123`,
    },
    {
      id: "c6m-ch7", number: 7, title: "Practical Geometry", titleBn: "ব্যবহারিক জ্যামিতি", bookPage: 143, endBookPage: 157,
      objectives: [
        "Measure a line segment.",
        "Use information to draw line segments.",
        "Draw figures of different measurement.",
      ],
      subtopics: [{ id: "c6m-ch7-1", title: "7.1 Line (tools: ruler, pencil-compass)", bookPage: 143 }],
      source: `${S}, Chapter Seven, book p. 143`,
    },
    {
      id: "c6m-ch8", number: 8, title: "Information and Data", titleBn: "তথ্য ও উপাত্ত", bookPage: 158, endBookPage: 171,
      objectives: [
        "Explain information and data.",
        "Determine the mean, median and mode of unarranged data without classification.",
        "Draw a line diagram.",
        "Describe the drawn line diagram.",
      ],
      subtopics: [{ id: "c6m-ch8-1", title: "8.1 Information", bookPage: 158 }],
      source: `${S}, Chapter Eight, book p. 158`,
    },
  ],
};

export type MathBookStatus =
  | { available: true; classLevel: number; chapters: MathChapter[]; edition: string }
  | { available: false; classLevel: number; reason: string };

export function mathBookForClass(classLevel: number): MathBookStatus {
  if (classLevel === 6) {
    return { available: true, classLevel, chapters: CLASS6_MATH.chapters, edition: CLASS6_MATH.edition };
  }
  return {
    available: false,
    classLevel,
    reason: `The NCTB Mathematics textbook for Class ${classLevel} has not been uploaded yet, so its chapters are not shown. Upload the official PDF to the Book folder and run the RAG ingestion to add them.`,
  };
}

export function getMathChapter(chapterId: string): MathChapter | null {
  return CLASS6_MATH.chapters.find((c) => c.id === chapterId) ?? null;
}
