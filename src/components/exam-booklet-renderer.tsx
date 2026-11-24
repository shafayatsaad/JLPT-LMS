"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, Eraser } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";
import { jlptFormats } from "@/lib/jlpt-format";
import { N5_PREVIEW_STORAGE_KEY, n5PreviewQuestions, type PreviewAnswer, type PreviewAnswers, type PreviewQuestion } from "@/lib/n5-preview";
import { n5DemoManifest, type N5DemoPage } from "@/lib/n5-demo-manifest";
import styles from "@/components/exam-booklet-renderer.module.css";

type ActiveTab = "booklet" | "answers";

const sectionLabels: Record<string, MessageKey> = {
  vocabulary: "exam.section.language_knowledge_vocabulary",
  "grammar-reading": "exam.section.language_knowledge_grammar_reading",
  listening: "exam.section.listening",
};
const itemLabels: Record<PreviewQuestion["itemType"], MessageKey> = {
  "kanji-reading": "exam.item.kanjiReading",
  "word-usage": "exam.item.usage",
  "grammar-form": "exam.item.sententialGrammarForm",
  "reading-comprehension": "exam.item.shortPassages",
};

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function readStoredAnswers(): PreviewAnswers {
  try {
    const stored = sessionStorage.getItem(N5_PREVIEW_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(n5PreviewQuestions.flatMap((question) => {
      const value = parsed[question.id];
      return ["A", "B", "C", "D"].includes(String(value)) ? [[question.id, value as PreviewAnswer]] : [];
    }));
  } catch {
    return {};
  }
}

export function ExamBookletRenderer({ adminPreview = false }: { adminPreview?: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>("booklet");
  const [answers, setAnswers] = useState<PreviewAnswers>({});
  const [loaded, setLoaded] = useState(false);
  const sections = jlptFormats.N5.sections;
  const [secondsRemaining, setSecondsRemaining] = useState<Record<string, number>>(() => Object.fromEntries(sections.map((section) => [section.code, section.minutes * 60])));
  const activePage = n5DemoManifest.pages[pageIndex] as N5DemoPage;
  const activeSection = activePage.sectionCode;
  const activeSectionRef = useRef<string | undefined>(activeSection);
  const visibleQuestions = useMemo(() => (activePage.questionIds ?? []).map((id) => n5PreviewQuestions.find((question) => question.id === id)).filter((question) => question !== undefined), [activePage]);
  const answeredCount = n5PreviewQuestions.filter((question) => answers[question.id]).length;
  const activeSeconds = activeSection ? secondsRemaining[activeSection] ?? 0 : null;
  const sectionTitle = activeSection && sectionLabels[activeSection] ? t(sectionLabels[activeSection]) : t("preview.examDirections");

  useEffect(() => {
    const load = window.setTimeout(() => {
      setAnswers(readStoredAnswers());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(load);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(N5_PREVIEW_STORAGE_KEY, JSON.stringify(answers)); } catch { /* The sample remains usable when storage is blocked. */ }
  }, [answers, loaded]);

  useEffect(() => { activeSectionRef.current = activeSection; }, [activeSection]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const sectionCode = activeSectionRef.current;
      if (!sectionCode) return;
      setSecondsRemaining((current) => ({ ...current, [sectionCode]: Math.max(0, (current[sectionCode] ?? 0) - 1) }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function chooseAnswer(questionId: string, answer: PreviewAnswer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  function eraseAnswer(questionId: string) {
    setAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  function showQuestionInBooklet(questionId: string) {
    const index = n5DemoManifest.pages.findIndex((page) => page.questionIds?.includes(questionId));
    if (index >= 0) setPageIndex(index);
    setActiveTab("booklet");
  }

  function movePage(delta: number) {
    setPageIndex((current) => Math.min(n5DemoManifest.pages.length - 1, Math.max(0, current + delta)));
  }

  function handleBubbleKey(event: React.KeyboardEvent<HTMLDivElement>, questionId: string, current: PreviewAnswer | undefined) {
    const choiceIndex = n5DemoManifest.answerSheet.choices.indexOf(current ?? "A");
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = n5DemoManifest.answerSheet.choices[(choiceIndex + delta + n5DemoManifest.answerSheet.choices.length) % n5DemoManifest.answerSheet.choices.length];
    chooseAnswer(questionId, next);
    window.requestAnimationFrame(() => document.getElementById(`answer-${questionId}-${next}`)?.focus());
  }

  return (
    <section className={styles.root} aria-label={t("preview.examInterface")}>
      <div className={styles.disclosure} role="note">
        <strong>{t("preview.sampleStamp")}</strong>
        <span>{adminPreview ? t("preview.adminPreviewNote") : t("preview.sessionBanner")}</span>
      </div>

      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <p>JLPT · N5 · {n5DemoManifest.formCode}</p>
          <h1>{t("preview.samplePaper")}</h1>
        </div>
        <div className={styles.timer} aria-label={activeSeconds === null ? t("preview.notStarted") : `${sectionTitle}: ${formatTime(activeSeconds)}`}>
          <strong><Clock3 size={15} aria-hidden="true" /> {activeSeconds === null ? "—:—" : formatTime(activeSeconds)}</strong>
          <span>{activeSeconds === null ? t("preview.notStarted") : t("preview.timer")}</span>
        </div>
      </header>

      <div className={styles.tabs} aria-label={t("preview.examInterface")}>
        <button className={`${styles.tab} ${activeTab === "booklet" ? styles.tabActive : ""}`} aria-pressed={activeTab === "booklet"} aria-controls="booklet-panel" type="button" onClick={() => setActiveTab("booklet")}>{t("preview.bookletMode")}</button>
        <button className={`${styles.tab} ${activeTab === "answers" ? styles.tabActive : ""}`} aria-pressed={activeTab === "answers"} aria-controls="answers-panel" type="button" onClick={() => setActiveTab("answers")}>{t("preview.answerSheet")} · {answeredCount}/{n5PreviewQuestions.length}</button>
      </div>

      <nav className={styles.pageNav} aria-label={t("preview.pageNavigation")}>
        <span className={styles.pageNavLabel}>{t("preview.pageNavigation")}</span>
        {n5DemoManifest.pages.map((page, index) => (
          <button key={page.id} type="button" className={`${styles.pageButton} ${index === pageIndex ? styles.pageButtonActive : ""}`} aria-current={index === pageIndex ? "page" : undefined} onClick={() => { setPageIndex(index); setActiveTab("booklet"); }}>
            <span>{String(page.printedPage).padStart(2, "0")}</span>
            {page.sectionCode && sectionLabels[page.sectionCode] ? t(sectionLabels[page.sectionCode]) : t("preview.examDirections")}
          </button>
        ))}
      </nav>

      <div className={`${styles.layout} ${activeTab === "answers" ? styles.layoutAnswers : styles.layoutBooklet}`}>
        <div className={styles.booklet} id="booklet-panel">
          <article className={styles.sheetPage} aria-label={`${t("preview.paperPage", { page: activePage.printedPage })} · ${sectionTitle}`}>
            <header className={styles.paperHeader}>
              <div>
                <div className={styles.paperHeaderTitle}>{n5DemoManifest.title}</div>
                <div className={styles.paperHeaderMeta}>N5 · {activePage.sectionCode ? sectionTitle : t("preview.examDirections")}</div>
              </div>
              <span className={styles.sampleStamp}>{t("preview.sampleStamp")}</span>
            </header>

            <div className={styles.pageBody}>
              {activePage.kind === "cover" ? (
                <>
                  <p className={styles.printedSection}>{t("preview.samplePaper")}</p>
                  <h2 className={styles.coverTitle}>{t("preview.examInterface")}</h2>
                  <p className={styles.coverLead}>{t("preview.coverLead")}</p>
                  <div className={styles.candidateBox} aria-label={t("preview.candidateNumber")}>
                    <div className={styles.candidateField}><span>{t("preview.candidateNumber")}</span><div className={styles.candidateLine} /></div>
                    <div className={styles.candidateField}><span aria-hidden="true">N5</span><div className={styles.candidateDigits} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></div>
                  </div>
                  <div className={styles.directions}>
                    <h3>{t("preview.examDirections")}</h3>
                    <p>{t("preview.coverScope")}</p>
                    <p>{t("preview.bookletInstructions")}</p>
                  </div>
                </>
              ) : null}

              {activePage.kind === "questions" ? (
                <>
                  <p className={styles.printedSection}>{sectionTitle}</p>
                  {activePage.id === "reading" ? <p className={styles.questionReadingLead} lang="ja">{t("preview.readingPassage")}</p> : null}
                  {visibleQuestions.map((question) => (
                    <section className={styles.question} key={question.id} aria-labelledby={`question-title-${question.id}`}>
                      <div className={styles.questionHeader}><span className={styles.questionNo}>{question.questionNumber}.</span><span className={styles.questionType}>{sectionLabels[question.sectionCode] ? t(sectionLabels[question.sectionCode]) : question.sectionCode} · {t(itemLabels[question.itemType])}</span></div>
                      <h2 className={styles.questionPrompt} id={`question-title-${question.id}`} lang="ja">{question.prompt}</h2>
                      <ol className={styles.printOptions} aria-label={t("preview.answerOptions")}>
                        {question.options.map((option) => <li key={option.id}><span>{option.id}</span><span lang="ja">{option.text}</span></li>)}
                      </ol>
                    </section>
                  ))}
                </>
              ) : null}

              {activePage.kind === "listening" ? (
                <>
                  <p className={styles.printedSection}>{sectionTitle}</p>
                  <div className={styles.listeningBlank}>
                    <strong>{t("preview.listeningTitle")}</strong>
                    <p>{t("preview.audioUnavailable")}</p>
                    <div className={styles.listenRule}>{t("preview.listeningTime", { minutes: sections.find((section) => section.code === "listening")?.minutes ?? 30 })}</div>
                  </div>
                </>
              ) : null}
            </div>

            <footer className={styles.pageFooter}><span>{n5DemoManifest.formCode}</span><span>{t("preview.paperPage", { page: activePage.printedPage })}</span></footer>
          </article>
          <div className={styles.mobileTools}>
            <button type="button" className={`${styles.control} ${styles.controlSecondary}`} onClick={() => movePage(-1)} disabled={pageIndex === 0}><ArrowLeft size={14} aria-hidden="true" /> {t("preview.previousPage")}</button>
            <button type="button" className={styles.control} onClick={() => movePage(1)} disabled={pageIndex === n5DemoManifest.pages.length - 1}>{t("preview.nextPage")} <ArrowRight size={14} aria-hidden="true" /></button>
          </div>
        </div>

        <aside className={styles.answerPanel} id="answers-panel" aria-label={t("preview.answerSheet")}>
          <div className={styles.answerPanelHeader}>
            <div><h2>{t("preview.answerSheet")}</h2><p>{t("preview.bookletInstructions")}</p></div>
            <span className={styles.answerCount}>{t("preview.answeredCount", { answered: answeredCount, total: n5PreviewQuestions.length })}</span>
          </div>
          {n5DemoManifest.answerSheet.rows.map((row) => {
            const question = n5PreviewQuestions.find((entry) => entry.id === row.questionId);
            if (!question) return null;
            const selected = answers[question.id];
            return (
              <div className={styles.answerRow} key={row.questionId}>
                <div className={styles.answerRowHeader}>
                  <strong>{t("preview.answerRow", { number: row.questionNumber })}</strong>
                  <button className={styles.questionLink} type="button" onClick={() => showQuestionInBooklet(question.id)}>{t("preview.bookletMode")}</button>
                </div>
                <div className={styles.bubbles} role="radiogroup" aria-label={t("preview.answerRow", { number: row.questionNumber })} onKeyDown={(event) => handleBubbleKey(event, row.questionId, selected)}>
                  {n5DemoManifest.answerSheet.choices.map((choice) => (
                    <button
                      key={choice}
                      id={`answer-${question.id}-${choice}`}
                      className={`${styles.bubble} ${selected === choice ? styles.bubbleSelected : ""}`}
                      type="button"
                      role="radio"
                      aria-checked={selected === choice}
                      aria-label={`${t("preview.answerRow", { number: row.questionNumber })}, ${choice}`}
                      tabIndex={selected === choice || (!selected && choice === "A") ? 0 : -1}
                      onClick={() => chooseAnswer(question.id, choice)}
                    >
                      <span className={styles.bubbleCircle}>{choice}</span>
                    </button>
                  ))}
                </div>
                <button className={styles.erase} type="button" disabled={!selected} onClick={() => eraseAnswer(question.id)} aria-label={t("preview.eraseAnswer", { number: row.questionNumber })}>
                  <Eraser size={12} aria-hidden="true" /> {t("preview.eraseAnswer", { number: row.questionNumber })}
                </button>
              </div>
            );
          })}
          <div className={styles.answerActions}>
            <button type="button" className={`${styles.control} ${styles.controlSecondary}`} onClick={() => movePage(-1)} disabled={pageIndex === 0}><ArrowLeft size={14} aria-hidden="true" /> {t("preview.previousPage")}</button>
            {pageIndex < n5DemoManifest.pages.length - 1 ? (
              <button type="button" className={styles.control} onClick={() => movePage(1)}>{t("preview.nextPage")} <ArrowRight size={14} aria-hidden="true" /></button>
            ) : (
              <button type="button" className={styles.control} onClick={() => router.push("/exams/n5/preview/results")}>{t("preview.finishSample")} <ArrowRight size={14} aria-hidden="true" /></button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
