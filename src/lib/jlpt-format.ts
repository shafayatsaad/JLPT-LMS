export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export type ScoreCategoryCode =
  | "language-knowledge"
  | "reading"
  | "listening"
  | "language-knowledge-reading";

export interface TimedSection {
  code: string;
  label: string;
  minutes: number;
  scoreCategories: ScoreCategoryCode[];
}

export interface JlptLevelFormat {
  level: JlptLevel;
  sections: TimedSection[];
  scoreCategories: { code: ScoreCategoryCode; label: string }[];
}

export const jlptFormats: Record<JlptLevel, JlptLevelFormat> = {
  N1: {
    level: "N1",
    sections: [
      {
        code: "language-knowledge-reading",
        label: "Language Knowledge + Reading",
        minutes: 110,
        scoreCategories: ["language-knowledge", "reading"],
      },
      { code: "listening", label: "Listening", minutes: 55, scoreCategories: ["listening"] },
    ],
    scoreCategories: [
      { code: "language-knowledge", label: "Language Knowledge (Vocabulary/Grammar)" },
      { code: "reading", label: "Reading" },
      { code: "listening", label: "Listening" },
    ],
  },
  N2: {
    level: "N2",
    sections: [
      {
        code: "language-knowledge-reading",
        label: "Language Knowledge + Reading",
        minutes: 105,
        scoreCategories: ["language-knowledge", "reading"],
      },
      { code: "listening", label: "Listening", minutes: 50, scoreCategories: ["listening"] },
    ],
    scoreCategories: [
      { code: "language-knowledge", label: "Language Knowledge (Vocabulary/Grammar)" },
      { code: "reading", label: "Reading" },
      { code: "listening", label: "Listening" },
    ],
  },
  N3: {
    level: "N3",
    sections: [
      {
        code: "vocabulary",
        label: "Vocabulary",
        minutes: 30,
        scoreCategories: ["language-knowledge"],
      },
      {
        code: "grammar-reading",
        label: "Grammar + Reading",
        minutes: 70,
        scoreCategories: ["language-knowledge", "reading"],
      },
      { code: "listening", label: "Listening", minutes: 40, scoreCategories: ["listening"] },
    ],
    scoreCategories: [
      { code: "language-knowledge", label: "Language Knowledge (Vocabulary/Grammar)" },
      { code: "reading", label: "Reading" },
      { code: "listening", label: "Listening" },
    ],
  },
  N4: {
    level: "N4",
    sections: [
      {
        code: "vocabulary",
        label: "Vocabulary",
        minutes: 25,
        scoreCategories: ["language-knowledge-reading"],
      },
      {
        code: "grammar-reading",
        label: "Grammar + Reading",
        minutes: 55,
        scoreCategories: ["language-knowledge-reading"],
      },
      { code: "listening", label: "Listening", minutes: 35, scoreCategories: ["listening"] },
    ],
    scoreCategories: [
      { code: "language-knowledge-reading", label: "Language Knowledge + Reading" },
      { code: "listening", label: "Listening" },
    ],
  },
  N5: {
    level: "N5",
    sections: [
      {
        code: "vocabulary",
        label: "Language Knowledge (Vocabulary)",
        minutes: 20,
        scoreCategories: ["language-knowledge-reading"],
      },
      {
        code: "grammar-reading",
        label: "Grammar + Reading",
        minutes: 40,
        scoreCategories: ["language-knowledge-reading"],
      },
      { code: "listening", label: "Listening", minutes: 30, scoreCategories: ["listening"] },
    ],
    scoreCategories: [
      { code: "language-knowledge-reading", label: "Language Knowledge + Reading" },
      { code: "listening", label: "Listening" },
    ],
  },
};

export const jlptLevels = Object.keys(jlptFormats) as JlptLevel[];

/** Database item type identifiers use snake_case, while authored manifests may use readable kebab-case. */
export function normalizeItemTypeCode(value: string) {
  return value.trim().toLowerCase().replaceAll("-", "_");
}

export const officialItemTypes = [
  { area: "Vocabulary", code: "kanji-reading", label: "Kanji reading", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Vocabulary", code: "orthography", label: "Orthography", levels: ["N2", "N3", "N4", "N5"] },
  { area: "Vocabulary", code: "word-formation", label: "Word formation", levels: ["N2"] },
  { area: "Vocabulary", code: "contextual-expressions", label: "Contextually-defined expressions", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Vocabulary", code: "paraphrases", label: "Paraphrases", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Vocabulary", code: "usage", label: "Usage", levels: ["N1", "N2", "N3", "N4"] },
  { area: "Grammar", code: "sentential-grammar-form", label: "Sentential grammar: selecting a form", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Grammar", code: "sentence-composition", label: "Sentential grammar: sentence composition", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Grammar", code: "text-grammar", label: "Text grammar", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Reading", code: "short-passages", label: "Comprehension: short passages", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Reading", code: "mid-size-passages", label: "Comprehension: mid-size passages", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Reading", code: "long-passages", label: "Comprehension: long passages", levels: ["N1", "N3"] },
  { area: "Reading", code: "integrated-comprehension", label: "Integrated comprehension", levels: ["N1", "N2"] },
  { area: "Reading", code: "thematic-comprehension", label: "Thematic comprehension", levels: ["N1", "N2"] },
  { area: "Reading", code: "information-retrieval", label: "Information retrieval", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Listening", code: "task-based-comprehension", label: "Task-based comprehension", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Listening", code: "key-points", label: "Comprehension of key points", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Listening", code: "general-outline", label: "Comprehension of general outline", levels: ["N1", "N2", "N3"] },
  { area: "Listening", code: "verbal-expressions", label: "Verbal expressions", levels: ["N3", "N4", "N5"] },
  { area: "Listening", code: "quick-response", label: "Quick response", levels: ["N1", "N2", "N3", "N4", "N5"] },
  { area: "Listening", code: "listening-integrated-comprehension", label: "Integrated comprehension", levels: ["N1", "N2"] },
] as const;

export const jlptSources = {
  checkedOn: "2026-11-22",
  sections: "https://www.jlpt.jp/e/guideline/testsections.html",
  results: "https://www.jlpt.jp/e/guideline/results.html",
} as const;
