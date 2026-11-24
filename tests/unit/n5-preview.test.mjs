import assert from "node:assert/strict";
import test from "node:test";
import { n5PreviewQuestions, scoreN5Preview } from "../../src/lib/n5-preview.ts";

test("N5 preview is a small original interface sample", () => {
  assert.equal(n5PreviewQuestions.length, 5);
  assert.equal(new Set(n5PreviewQuestions.map((question) => question.id)).size, n5PreviewQuestions.length);
  assert.ok(n5PreviewQuestions.every((question) => question.options.length === 4));
  assert.ok(n5PreviewQuestions.every((question) => question.options.some((option) => option.id === question.correctOption)));
});

test("preview scoring separates correct, incorrect, and unanswered questions", () => {
  const [vocabulary, grammar] = n5PreviewQuestions;
  assert.deepEqual(
    scoreN5Preview({ [vocabulary.id]: vocabulary.correctOption, [grammar.id]: "A" }),
    { correct: 1, answered: 2, incorrect: 1, unanswered: 3 },
  );
  assert.deepEqual(scoreN5Preview({}), { correct: 0, answered: 0, incorrect: 0, unanswered: 5 });
  assert.deepEqual(
    scoreN5Preview({ [vocabulary.id]: vocabulary.correctOption, unknown: "D" }),
    { correct: 1, answered: 1, incorrect: 0, unanswered: 4 },
  );
});
