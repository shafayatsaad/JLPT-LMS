"use client";

import { useState } from "react";
import { jlptFormats, jlptLevels, type JlptLevel } from "@/lib/jlpt-format";

export function LevelFormatSelector() {
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const selected = jlptFormats[selectedLevel];
  const categoryLabels = new Map(selected.scoreCategories.map((category) => [category.code, category.label]));

  return (
    <div className="ui format-picker" role="group" aria-label="JLPT test format by level">
      <div className="format-picker__tabs" role="tablist" aria-label="JLPT level">
        {jlptLevels.map((level) => (
          <button
            key={level}
            className="format-picker__tab"
            id={`format-tab-${level.toLowerCase()}`}
            type="button"
            role="tab"
            aria-selected={selectedLevel === level}
            aria-controls={`format-panel-${level.toLowerCase()}`}
            tabIndex={selectedLevel === level ? 0 : -1}
            onClick={() => setSelectedLevel(level)}
            onKeyDown={(event) => {
              const currentIndex = jlptLevels.indexOf(selectedLevel);
              const nextIndex = event.key === "ArrowRight"
                ? (currentIndex + 1) % jlptLevels.length
                : event.key === "ArrowLeft"
                  ? (currentIndex - 1 + jlptLevels.length) % jlptLevels.length
                  : -1;
              if (nextIndex >= 0) {
                event.preventDefault();
                setSelectedLevel(jlptLevels[nextIndex]);
                document.getElementById(`format-tab-${jlptLevels[nextIndex].toLowerCase()}`)?.focus();
              }
            }}
          >
            {level}
          </button>
        ))}
      </div>

      <div
        className="format-picker__panel"
        id={`format-panel-${selectedLevel.toLowerCase()}`}
        role="tabpanel"
        aria-labelledby={`format-tab-${selectedLevel.toLowerCase()}`}
        tabIndex={0}
      >
        <div className="format-picker__heading">
          <h3>{selectedLevel} test sections</h3>
        </div>
        <div className="format-table-wrap">
          <table className="format-table">
            <thead>
              <tr>
                <th scope="col">Timed test section</th>
                <th scope="col">Time</th>
                <th scope="col">Score-report category</th>
              </tr>
            </thead>
            <tbody>
              {selected.sections.map((section) => (
                <tr key={section.code}>
                  <th scope="row">{section.label}</th>
                  <td className="format-table__time">{section.minutes} min</td>
                  <td>{section.scoreCategories.map((code) => categoryLabels.get(code)).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="format-picker__foot">
          <a className="link" href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noreferrer">
            JLPT section guide
          </a>
        </div>
      </div>
    </div>
  );
}
