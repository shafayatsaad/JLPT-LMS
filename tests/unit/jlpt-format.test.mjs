import assert from "node:assert/strict";
import test from "node:test";
import { jlptFormats, jlptLevels } from "../../src/lib/jlpt-format.ts";

test("JLPT format data covers N1 through N5 with valid timed sections", () => {
  assert.deepEqual(jlptLevels, ["N1", "N2", "N3", "N4", "N5"]);

  for (const level of jlptLevels) {
    const format = jlptFormats[level];
    const categories = new Set(format.scoreCategories.map((category) => category.code));

    assert.equal(format.level, level);
    assert.ok(format.sections.length > 0, `${level} has timed sections`);
    assert.ok(format.scoreCategories.length > 0, `${level} has score categories`);
    for (const section of format.sections) {
      assert.ok(Number.isInteger(section.minutes) && section.minutes > 0, `${level}/${section.code} has positive minutes`);
      assert.ok(section.scoreCategories.length > 0, `${level}/${section.code} maps to a score category`);
      for (const category of section.scoreCategories) {
        assert.ok(categories.has(category), `${level}/${section.code} maps to a category reported at this level`);
      }
    }
  }
});

test("verified section-time totals remain aligned to the current JLPT matrix", () => {
  const totals = Object.fromEntries(
    jlptLevels.map((level) => [level, jlptFormats[level].sections.reduce((sum, section) => sum + section.minutes, 0)]),
  );

  assert.deepEqual(totals, { N1: 165, N2: 155, N3: 140, N4: 115, N5: 90 });
});
