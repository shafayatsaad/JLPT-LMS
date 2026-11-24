import { n5PreviewQuestions } from "./n5-preview";

export type N5DemoPage = {
  id: string;
  printedPage: number;
  kind: "cover" | "questions" | "listening";
  sectionCode?: "vocabulary" | "grammar-reading" | "listening";
  questionIds?: readonly string[];
};

// Presentation order and printed page numbers live separately from question content.
export const n5DemoManifest = {
  formCode: "N5-DEMO-01",
  title: "Japanese-Language Proficiency Test",
  pages: [
    { id: "cover", printedPage: 1, kind: "cover" },
    { id: "vocabulary", printedPage: 2, kind: "questions", sectionCode: "vocabulary", questionIds: ["vocabulary-water-kanji", "vocabulary-weather", "grammar-time-particle", "reading-library-day", "reading-library-book"] },
  ] satisfies readonly N5DemoPage[],
  answerSheet: {
    formCode: "N5-DEMO-01",
    choices: ["A", "B", "C", "D"] as const,
    rows: [1, 2, 3, 4, 5].map((questionNumber) => {
      const question = n5PreviewQuestions.find((entry) => entry.questionNumber === questionNumber);
      if (!question) throw new Error(`N5 demo answer-sheet row ${questionNumber} has no question.`);
      return { questionNumber, questionId: question.id };
    }),
  },
} as const;

const pageQuestionIds = n5DemoManifest.pages.flatMap((page) => page.questionIds ?? []);
const sheetQuestionIds = n5DemoManifest.answerSheet.rows.map((row) => row.questionId);

if (new Set(pageQuestionIds).size !== pageQuestionIds.length) {
  throw new Error("N5 demo manifest places a question on more than one booklet page.");
}
if (new Set(sheetQuestionIds).size !== sheetQuestionIds.length) {
  throw new Error("N5 demo answer sheet maps a question more than once.");
}
if (n5PreviewQuestions.some((question) => !pageQuestionIds.includes(question.id) || !sheetQuestionIds.includes(question.id))) {
  throw new Error("N5 demo manifest and answer sheet must include every sample question exactly once.");
}
if (pageQuestionIds.length !== n5PreviewQuestions.length || sheetQuestionIds.length !== n5PreviewQuestions.length) {
  throw new Error("N5 demo manifest contains an unknown question mapping.");
}
