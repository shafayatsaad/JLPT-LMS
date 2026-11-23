"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleHelp } from "lucide-react";
import { N5_PREVIEW_STORAGE_KEY, n5PreviewQuestions, type PreviewAnswers } from "@/lib/n5-preview";
import { useLocale } from "@/components/i18n/locale-provider";

export function N5PreviewReview() {
  const { t } = useLocale();
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(N5_PREVIEW_STORAGE_KEY);
      if (stored) setAnswers(JSON.parse(stored) as PreviewAnswers);
    } catch { setAnswers({}); }
    setLoaded(true);
  }, []);

  if (!loaded) return <p className="result-loading" aria-live="polite">{t("preview.reviewLoading")}</p>;
  return (
    <>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> {t("preview.reviewEyebrow")}</p>
          <h1>{t("preview.reviewTitle")}</h1>
          <p className="product-lede">{t("preview.reviewDescription")}</p>
          <div className="preview-disclosure"><strong>{t("preview.sampleContent")}</strong><p>{t("preview.sampleContentBody")}</p></div>
        </div>
      </section>
      <section className="product-section">
        <div className="product-wrap answer-review-list">
          {n5PreviewQuestions.map((question, index) => {
            const chosen = answers[question.id];
            const correct = chosen === question.correctOption;
            const areaLabel = question.area.startsWith("Grammar") ? t("exam.item.sententialGrammarForm") : t("exam.item.kanjiReading");
            const selectedText = question.options.find((option) => option.id === chosen)?.text;
            const correctText = question.options.find((option) => option.id === question.correctOption)?.text;
            return (
              <article className="answer-review-card" key={question.id}>
                <div className="answer-review-card__head"><span>0{index + 1} · {areaLabel}</span><span className={chosen ? (correct ? "review-status review-status--correct" : "review-status review-status--wrong") : "review-status review-status--empty"}>{chosen ? (correct ? t("review.correct") : t("review.reviewThis")) : t("review.unanswered")}</span></div>
                <h2 lang="ja">{question.prompt}</h2>
                <div className="answer-review-card__answers">
                  <p><span>{t("review.yourResponse")}</span><strong>{selectedText ? `${chosen} · ${selectedText}` : t("review.noResponse")}</strong></p>
                  <p><span>{t("review.correctAnswer")}</span><strong><Check size={15} aria-hidden="true" /> {question.correctOption} · {correctText}</strong></p>
                </div>
                <div className="answer-review-card__explanation"><CircleHelp size={17} aria-hidden="true" /><p>{question.explanation}</p></div>
              </article>
            );
          })}
          <div className="result-actions"><Link className="product-button product-button--quiet" href="/exams/n5/preview/results"><ArrowLeft size={16} aria-hidden="true" /> {t("preview.backResult")}</Link><Link className="product-text-link" href="/exams/n5/preview">{t("preview.overview")}</Link></div>
        </div>
      </section>
    </>
  );
}
