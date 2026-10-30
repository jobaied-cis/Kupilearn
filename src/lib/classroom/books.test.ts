import { describe, expect, it } from "vitest";
import { booksForClass, findBook, findChapter } from "./books";

describe("classroom books", () => {
  it("offers books for every class 6-10, each with chapters", () => {
    for (const cls of [6, 7, 8, 9, 10]) {
      const books = booksForClass(cls);
      expect(books.length).toBeGreaterThan(0);
      for (const book of books) {
        expect(book.classLevel).toBe(cls);
        expect(book.chapters.length).toBeGreaterThan(0);
        for (const ch of book.chapters) expect(ch.objectives.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the real uploaded NCTB chapters for Class 6 Mathematics", () => {
    const math = findBook(6, "c6-math");
    expect(math).not.toBeNull();
    expect(math?.chapters.map((c) => c.title)).toEqual([
      "Natural Numbers and Fractions",
      "Ratios and Percentages",
      "Integers",
      "Algebraic Expressions",
      "Simple Equations",
      "Basic Concepts of Geometry",
      "Practical Geometry",
      "Information and Data",
    ]);
    expect(math?.chapters[4]).toMatchObject({ mathChapterId: "c6m-ch5", bookPage: 110 });
    expect(findChapter(6, "c6-math", "c6m-ch5")?.title).toBe("Simple Equations");
  });

  it("gives catalog chapters a lesson topic for other classes", () => {
    const math9 = findBook(9, "c9-math");
    expect(math9?.chapters[0]?.topicId).toBeTruthy();
    expect(math9?.chapters[0]?.mathChapterId).toBeUndefined();
  });

  it("returns nothing for classes outside 6-10", () => {
    expect(booksForClass(5)).toEqual([]);
    expect(findBook(11, "c11-math")).toBeNull();
  });
});
