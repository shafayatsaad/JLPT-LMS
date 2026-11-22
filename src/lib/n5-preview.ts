export const N5_PREVIEW_STORAGE_KEY = "jlpt-n5-interface-preview-v1";

export type PreviewAnswer = "A" | "B" | "C" | "D";
export type PreviewAnswers = Record<string, PreviewAnswer | undefined>;

export const n5PreviewQuestions = [
  {
    id: "vocabulary-water-kanji",
    sectionIndex: 0,
    area: "Vocabulary · Kanji reading",
    prompt: "「みず」を漢字で書くとどれですか。",
    options: [
      { id: "A", text: "水" },
      { id: "B", text: "木" },
      { id: "C", text: "火" },
      { id: "D", text: "金" },
    ],
    correctOption: "A" as PreviewAnswer,
    explanation: "水 is read みず and means “water.” The other choices are 木 (tree/wood), 火 (fire), and 金 (gold/money).",
  },
  {
    id: "grammar-time-particle",
    sectionIndex: 1,
    area: "Grammar · Selecting a form",
    prompt: "まいあさ 7時（　）おきます。",
    options: [
      { id: "A", text: "で" },
      { id: "B", text: "を" },
      { id: "C", text: "に" },
      { id: "D", text: "が" },
    ],
    correctOption: "C" as PreviewAnswer,
    explanation: "に marks the specific time when the action happens: 7時におきます (“I wake up at seven”).",
  },
] as const;

export function scoreN5Preview(answers: PreviewAnswers) {
  const correct = n5PreviewQuestions.filter((question) => answers[question.id] === question.correctOption).length;
  const answered = n5PreviewQuestions.filter((question) => Boolean(answers[question.id])).length;
  return { correct, answered, incorrect: answered - correct, unanswered: n5PreviewQuestions.length - answered };
}
