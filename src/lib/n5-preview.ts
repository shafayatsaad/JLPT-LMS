export const N5_PREVIEW_STORAGE_KEY = "jlpt-n5-interface-preview-v2";

export type PreviewAnswer = "A" | "B" | "C" | "D";
export type PreviewAnswers = Record<string, PreviewAnswer | undefined>;

export type PreviewQuestion = {
  id: string;
  questionNumber: number;
  sectionCode: "vocabulary" | "grammar-reading";
  area: string;
  itemType: "kanji-reading" | "word-usage" | "grammar-form" | "reading-comprehension";
  prompt: string;
  options: { id: PreviewAnswer; text: string }[];
  correctOption: PreviewAnswer;
  explanation: string;
};

// Original sample questions created only to demonstrate the paper renderer.
export const n5PreviewQuestions: readonly PreviewQuestion[] = [
  {
    id: "vocabulary-water-kanji",
    questionNumber: 1,
    sectionCode: "vocabulary",
    area: "Vocabulary · Kanji reading",
    itemType: "kanji-reading",
    prompt: "「水」の読み方はどれですか。",
    options: [
      { id: "A", text: "みず" },
      { id: "B", text: "き" },
      { id: "C", text: "ひ" },
      { id: "D", text: "かね" },
    ],
    correctOption: "A",
    explanation: "水 is read みず and means “water.” The other readings are 木 (き), 火 (ひ), and 金 (かね).",
  },
  {
    id: "vocabulary-weather",
    questionNumber: 2,
    sectionCode: "vocabulary",
    area: "Vocabulary · Word usage",
    itemType: "word-usage",
    prompt: "きょうは あめです。かさを（　）。",
    options: [
      { id: "A", text: "のみます" },
      { id: "B", text: "かいます" },
      { id: "C", text: "さします" },
      { id: "D", text: "あけます" },
    ],
    correctOption: "C",
    explanation: "さします is used with かさ: かさをさします means “to use/open an umbrella.”",
  },
  {
    id: "grammar-time-particle",
    questionNumber: 3,
    sectionCode: "vocabulary",
    area: "Vocabulary · Word meaning",
    itemType: "word-usage",
    prompt: "「きのう」のいみは どれですか。",
    options: [
      { id: "A", text: "きょう" },
      { id: "B", text: "あした" },
      { id: "C", text: "まえの日" },
      { id: "D", text: "つぎの週" },
    ],
    correctOption: "C",
    explanation: "きのう means the day before today (the previous day).",
  },
  {
    id: "reading-library-day",
    questionNumber: 4,
    sectionCode: "vocabulary",
    area: "Vocabulary · Word meaning",
    itemType: "word-usage",
    prompt: "「らいしゅう」は いつですか。",
    options: [
      { id: "A", text: "こんどの週" },
      { id: "B", text: "きのう" },
      { id: "C", text: "きょう" },
      { id: "D", text: "まい日" },
    ],
    correctOption: "A",
    explanation: "らいしゅう means next week (the upcoming week).",
  },
  {
    id: "reading-library-book",
    questionNumber: 5,
    sectionCode: "vocabulary",
    area: "Vocabulary · Word usage",
    itemType: "word-usage",
    prompt: "としょかんで ほんを（　）。",
    options: [
      { id: "A", text: "のみます" },
      { id: "B", text: "よみます" },
      { id: "C", text: "ききます" },
      { id: "D", text: "ねます" },
    ],
    correctOption: "B",
    explanation: "ほんを よみます means “read a book”; this is the natural verb for a book at a library.",
  },
] as const;

export function scoreN5Preview(answers: PreviewAnswers) {
  const correct = n5PreviewQuestions.filter((question) => answers[question.id] === question.correctOption).length;
  const answered = n5PreviewQuestions.filter((question) => Boolean(answers[question.id])).length;
  return { correct, answered, incorrect: answered - correct, unanswered: n5PreviewQuestions.length - answered };
}
