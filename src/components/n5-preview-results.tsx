"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { N5_PREVIEW_STORAGE_KEY, scoreN5Preview, type PreviewAnswers } from "@/lib/n5-preview";

export function N5PreviewResults() {
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(N5_PREVIEW_STORAGE_KEY);
      if (stored) setAnswers(JSON.parse(stored) as PreviewAnswers);
    } catch { setAnswers({}); }
    setLoaded(true);
  }, []);

  if (!loaded) return <p className="result-loading" aria-live="polite">Loading preview summary…</p>;
  const score = scoreN5Preview(answers);
  return (
    <>
      <section className="result-hero" data-enter>
        <div className="result-hero__stamp"><BookOpenCheck size={23} aria-hidden="true" /><span>PREVIEW<br />COMPLETE</span></div>
        <div><p className="product-eyebrow">N5 interface preview</p><h1>Sample result</h1><p className="product-lede">This summary covers two original sample questions only. It is not a full mock exam result.</p></div>
        <div className="result-score"><strong>{score.correct}<small> / 2</small></strong><span>sample questions correct</span></div>
      </section>
      <section className="product-section result-breakdown">
        <div className="product-wrap">
          <div className="result-counts">
            <div><span>Correct</span><strong>{score.correct}</strong></div>
            <div><span>Incorrect</span><strong>{score.incorrect}</strong></div>
            <div><span>Unanswered</span><strong>{score.unanswered}</strong></div>
          </div>
          <p className="product-note"><span aria-hidden="true">◎</span> JLPT uses scaled scores. This small preview reports a raw sample count and does not estimate an official score or pass outcome.</p>
          <div className="result-actions"><Link className="product-button" href="/exams/n5/preview/review">Review sample answers <ArrowRight size={16} aria-hidden="true" /></Link><Link className="product-text-link" href="/levels/n5">Return to N5 guide</Link></div>
        </div>
      </section>
    </>
  );
}
