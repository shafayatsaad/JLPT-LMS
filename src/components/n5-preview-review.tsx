"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleHelp } from "lucide-react";
import { N5_PREVIEW_STORAGE_KEY, n5PreviewQuestions, type PreviewAnswers } from "@/lib/n5-preview";

export function N5PreviewReview() {
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(N5_PREVIEW_STORAGE_KEY);
      if (stored) setAnswers(JSON.parse(stored) as PreviewAnswers);
    } catch { setAnswers({}); }
    setLoaded(true);
  }, []);

  if (!loaded) return <p className="result-loading" aria-live="polite">Loading answer review…</p>;
  return (
    <>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> N5 · Sample review</p>
          <h1>Review your answers</h1>
          <p className="product-lede">Compare each sample response with the answer and its explanation.</p>
          <div className="preview-disclosure"><strong>Sample content</strong><p>These two original examples demonstrate the review screen. They are not published JLPT questions.</p></div>
        </div>
      </section>
      <section className="product-section">
        <div className="product-wrap answer-review-list">
          {n5PreviewQuestions.map((question, index) => {
            const chosen = answers[question.id];
            const correct = chosen === question.correctOption;
            const selectedText = question.options.find((option) => option.id === chosen)?.text;
            const correctText = question.options.find((option) => option.id === question.correctOption)?.text;
            return (
              <article className="answer-review-card" key={question.id}>
                <div className="answer-review-card__head"><span>0{index + 1} · {question.area}</span><span className={chosen ? (correct ? "review-status review-status--correct" : "review-status review-status--wrong") : "review-status review-status--empty"}>{chosen ? (correct ? "Correct" : "Review this item") : "Unanswered"}</span></div>
                <h2 lang="ja">{question.prompt}</h2>
                <div className="answer-review-card__answers">
                  <p><span>Your response</span><strong>{selectedText ? `${chosen} · ${selectedText}` : "No response selected"}</strong></p>
                  <p><span>Correct answer</span><strong><Check size={15} aria-hidden="true" /> {question.correctOption} · {correctText}</strong></p>
                </div>
                <div className="answer-review-card__explanation"><CircleHelp size={17} aria-hidden="true" /><p>{question.explanation}</p></div>
              </article>
            );
          })}
          <div className="result-actions"><Link className="product-button product-button--quiet" href="/exams/n5/preview/results"><ArrowLeft size={16} aria-hidden="true" /> Back to sample result</Link><Link className="product-text-link" href="/exams/n5/preview">N5 preview overview</Link></div>
        </div>
      </section>
    </>
  );
}
