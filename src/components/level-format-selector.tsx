"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { jlptFormats, jlptLevels, type JlptLevel } from "@/lib/jlpt-format";
import type { MessageKey } from "@/lib/i18n";
import { useLocale } from "@/components/i18n/locale-provider";

const sectionLabels: Record<string, MessageKey> = {
  "language-knowledge-reading": "format.section.languageKnowledgeReading",
  "grammar-reading": "format.section.grammarReading",
  vocabulary: "format.section.vocabulary",
  listening: "format.section.listening",
};

const categoryLabels: Record<string, MessageKey> = {
  "language-knowledge": "format.category.languageKnowledge",
  reading: "format.category.reading",
  listening: "format.category.listening",
  "language-knowledge-reading": "format.category.languageKnowledgeReading",
};

export function LevelFormatSelector() {
  const { t } = useLocale();
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const selected = jlptFormats[selectedLevel];
  const localizedCategories = new Map(selected.scoreCategories.map((category) => [category.code, t(categoryLabels[category.code])]));
  const totalMinutes = selected.sections.reduce((total, section) => total + section.minutes, 0);

  return (
    <div className="ui format-picker" role="group" aria-label={t("format.aria")}>
      <div className="format-picker__tabs" role="tablist" aria-label={t("format.levels")}>
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
        className="ui ui-panel format-time-strip"
        role="img"
        aria-label={`${selectedLevel}: ${selected.sections.map((section) => `${t(sectionLabels[section.code])}, ${section.minutes} ${t("format.minutes")}`).join("; ")}.`}
      >
        {selected.sections.map((section, index) => (
          <span
            key={section.code}
            className={`format-time-strip__segment format-time-strip__segment--${index + 1}`}
            style={{ flexGrow: section.minutes }}
          >
            <strong className="format-time-strip__duration">{section.minutes}<small> {t("format.minutes")}</small></strong>
            <span className="format-time-strip__name">
              {t(sectionLabels[section.code])}
            </span>
            <span className="format-time-strip__ordinal">{t("format.sectionOrdinal", { number: String(index + 1).padStart(2, "0") })}</span>
          </span>
        ))}
      </div>
      <p className="format-time-total" aria-hidden="true">{t("format.totalMinutes", { minutes: totalMinutes })}</p>

      <div
        className="format-picker__panel"
        id={`format-panel-${selectedLevel.toLowerCase()}`}
        role="tabpanel"
        aria-labelledby={`format-tab-${selectedLevel.toLowerCase()}`}
        tabIndex={0}
      >
        <div className="format-table-wrap">
          <table className="format-table">
            <thead>
              <tr>
                <th scope="col">{t("format.column.section")}</th>
                <th scope="col">{t("format.column.time")}</th>
                <th scope="col">{t("format.column.category")}</th>
              </tr>
            </thead>
            <tbody>
              {selected.sections.map((section) => (
                <tr key={section.code}>
                  <th scope="row">{t(sectionLabels[section.code])}</th>
                  <td className="format-table__time">{section.minutes} {t("format.minutes")}</td>
                  <td>{section.scoreCategories.map((code) => localizedCategories.get(code)).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="format-picker__foot">
          <Link className="link" href="/levels">
            {t("format.browseLevels")} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
