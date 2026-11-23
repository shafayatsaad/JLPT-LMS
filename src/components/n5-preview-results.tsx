"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { N5_PREVIEW_STORAGE_KEY, scoreN5Preview, type PreviewAnswers } from "@/lib/n5-preview";
import { useLocale } from "@/components/i18n/locale-provider";

export function N5PreviewResults() {
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

  if (!loaded) return <p className="result-loading" aria-live="polite">{t("preview.loadingResults")}</p>;
  const score = scoreN5Preview(answers);
  return (
    <>
      <section className="result-hero" data-enter>
        <div className="result-hero__stamp"><BookOpenCheck size={23} aria-hidden="true" /><span>{t("preview.completeLabel")}</span></div>
        <div><p className="product-eyebrow">{t("preview.eyebrow")}</p><h1>{t("preview.resultTitle")}</h1><p className="product-lede">{t("preview.resultDescription")}</p></div>
        <div className="result-score"><strong>{score.correct}<small> / 2</small></strong><span>{t("preview.sampleCorrect")}</span></div>
      </section>
      <section className="product-section result-breakdown">
        <div className="product-wrap">
          <div className="result-counts">
            <div><span>{t("preview.resultCorrect")}</span><strong>{score.correct}</strong></div>
            <div><span>{t("preview.resultIncorrect")}</span><strong>{score.incorrect}</strong></div>
            <div><span>{t("preview.resultUnanswered")}</span><strong>{score.unanswered}</strong></div>
          </div>
          <p className="product-note"><span aria-hidden="true">◎</span> {t("preview.scoreCaveat")}</p>
          <div className="result-actions"><Link className="product-button" href="/exams/n5/preview/review">{t("preview.reviewAnswers")} <ArrowRight size={16} aria-hidden="true" /></Link><Link className="product-text-link" href="/levels/n5">{t("preview.returnGuide")}</Link></div>
        </div>
      </section>
    </>
  );
}
