"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, Headphones, Send } from "lucide-react";
import { jlptFormats } from "@/lib/jlpt-format";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";
import { N5_PREVIEW_STORAGE_KEY, n5PreviewQuestions, type PreviewAnswer, type PreviewAnswers } from "@/lib/n5-preview";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function sectionLabel(code: string, t: (key: MessageKey, values?: Record<string, string | number>) => string) {
  const keys: Record<string, MessageKey> = {
    vocabulary: "exam.section.language_knowledge_vocabulary",
    "grammar-reading": "exam.section.language_knowledge_grammar_reading",
    listening: "exam.section.listening",
  };
  return keys[code] ? t(keys[code]) : code;
}

export function N5PreviewExam() {
  const { t } = useLocale();
  const router = useRouter();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [loaded, setLoaded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(jlptFormats.N5.sections[0].minutes * 60);
  const sections = jlptFormats.N5.sections;
  const activeQuestion = useMemo(() => n5PreviewQuestions.find((question) => question.sectionIndex === sectionIndex), [sectionIndex]);
  const isListening = sectionIndex === 2;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(N5_PREVIEW_STORAGE_KEY);
      if (stored) setAnswers(JSON.parse(stored) as PreviewAnswers);
    } catch {
      setAnswers({});
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(N5_PREVIEW_STORAGE_KEY, JSON.stringify(answers)); } catch { /* Preview remains usable when storage is blocked. */ }
  }, [answers, loaded]);

  useEffect(() => {
    setSecondsLeft(sections[sectionIndex].minutes * 60);
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [sectionIndex, sections]);

  function chooseAnswer(answer: PreviewAnswer) {
    if (!activeQuestion) return;
    setAnswers((current) => ({ ...current, [activeQuestion.id]: answer }));
  }

  function openResults() {
    router.push("/exams/n5/preview/results");
  }

  return (
    <div className="exam-workspace">
      <div className="exam-preview-banner" role="note">{t("preview.sessionBanner")}</div>
      <div className="exam-workspace__head">
        <div><span className="exam-kicker">JLPT · N5</span><h1>{t("preview.examInterface")}</h1><p>{t("preview.sampleQuestions")}</p></div>
        <div className="exam-clock" aria-label={`${t("preview.timer")} ${formatTime(secondsLeft)}`}><Clock3 size={17} aria-hidden="true" /><span>{formatTime(secondsLeft)}</span><small>{t("preview.timer")}</small></div>
      </div>

      <div className="exam-progress" aria-label={t("exam.sections")}>
        {sections.map((section, index) => (
          <button className={`exam-progress__section ${index === sectionIndex ? "is-active" : ""} ${index < 2 && answers[n5PreviewQuestions[index].id] ? "is-answered" : ""}`} type="button" key={section.code} onClick={() => setSectionIndex(index)} aria-current={index === sectionIndex ? "step" : undefined}>
            <span className="exam-progress__index">0{index + 1}</span><span className="exam-progress__name">{sectionLabel(section.code, t)}</span><span className="exam-progress__time">{section.minutes} {t("preview.minute")}</span>
          </button>
        ))}
      </div>

      <div className="exam-question-layout">
        <aside className="exam-question-rail">
          <p>{t("preview.items")}</p>
          <button type="button" className={`exam-question-rail__item ${sectionIndex === 0 ? "is-active" : ""}`} onClick={() => setSectionIndex(0)}><span>01</span>{t("exam.section.language_knowledge_vocabulary")}{answers[n5PreviewQuestions[0].id] && <Check size={15} aria-label={t("exam.answered")} />}</button>
          <button type="button" className={`exam-question-rail__item ${sectionIndex === 1 ? "is-active" : ""}`} onClick={() => setSectionIndex(1)}><span>02</span>{t("preview.grammar")}{answers[n5PreviewQuestions[1].id] && <Check size={15} aria-label={t("exam.answered")} />}</button>
          <div className={`exam-question-rail__item exam-question-rail__item--quiet ${sectionIndex === 2 ? "is-active" : ""}`}><span>—</span>{t("exam.section.listening")}</div>
        </aside>

        <section className="exam-question-panel" aria-live="polite">
          {activeQuestion ? (
            <>
              <div className="exam-question-panel__meta"><span>{activeQuestion.area.startsWith("Grammar") ? t("exam.item.sententialGrammarForm") : t("exam.item.kanjiReading")}</span><span>{t("preview.sampleItem")}</span></div>
              <p className="exam-question-panel__instruction">{t("preview.selectAnswer")}</p>
              <h2 lang="ja">{activeQuestion.prompt}</h2>
              <fieldset className="exam-answer-list">
                <legend className="sr-only">{t("preview.answerOptions")}</legend>
                {activeQuestion.options.map((option) => (
                  <label className={`exam-answer-option ${answers[activeQuestion.id] === option.id ? "is-selected" : ""}`} key={option.id}>
                    <input type="radio" name={activeQuestion.id} value={option.id} checked={answers[activeQuestion.id] === option.id} onChange={() => chooseAnswer(option.id as PreviewAnswer)} />
                    <span className="exam-answer-option__letter">{option.id}</span><span lang="ja">{option.text}</span>
                  </label>
                ))}
              </fieldset>
              <div className="exam-question-panel__footer">
                <button className="exam-control exam-control--quiet" type="button" disabled={sectionIndex === 0} onClick={() => setSectionIndex((index) => Math.max(0, index - 1))}><ArrowLeft size={16} aria-hidden="true" /> {t("preview.previous")}</button>
                {sectionIndex === 0 ? <button className="exam-control" type="button" onClick={() => setSectionIndex(1)}>{t("preview.nextSample")} <ArrowRight size={16} aria-hidden="true" /></button> : <button className="exam-control" type="button" onClick={openResults}>{t("preview.finish")} <Send size={15} aria-hidden="true" /></button>}
              </div>
            </>
          ) : (
            <div className="exam-listening-placeholder">
              <span className="exam-listening-placeholder__icon"><Headphones size={22} aria-hidden="true" /></span>
              <p className="exam-question-panel__meta">{t("preview.listeningTime", { minutes: sections[sectionIndex].minutes })}</p>
              <h2>{t("preview.listeningTitle")}</h2>
              <p>{t("preview.noAudio")}</p>
              <button className="exam-control" type="button" onClick={openResults}>{t("preview.finish")} <Send size={15} aria-hidden="true" /></button>
            </div>
          )}
        </section>
      </div>
      <p className="exam-save-state" aria-live="polite">{Object.values(answers).some(Boolean) ? t("preview.responsesHeld") : t("preview.noResponse")}</p>
    </div>
  );
}
