"use client";

import { ArrowUpRight, BookOpen, Check, Clock3, RotateCcw } from "lucide-react";
import { HeroTreeMedia } from "@/components/hero-tree-media";
import { LevelFormatSelector } from "@/components/level-format-selector";
import { useLocale } from "@/components/i18n/locale-provider";

export function HomeContent() {
  const { t } = useLocale();

  return (
    <main id="top" className="origami-theme" tabIndex={-1}>
      <section className="hero hero--split" data-enter aria-labelledby="hero-h">
        <div className="wrap">
          <div className="hero-text grid hero__grid">
            <div className="hero__text span-5">
              <p className="hero__kicker"><span className="dot" aria-hidden="true" />{t("home.hero.kicker")}</p>
              <h1 id="hero-h">{t("home.hero.title")}</h1>
              <p className="hero__lead">{t("home.hero.lead")}</p>
              <div className="btn-row">
                <a className="btn btn--primary" href="#levels">{t("home.hero.chooseLevel")}<ArrowUpRight size={16} aria-hidden="true" /></a>
                <a className="btn btn--secondary" href="#practice">{t("home.hero.seeReview")}</a>
              </div>
            </div>
            <HeroTreeMedia />
          </div>
        </div>
      </section>

      <section className="section ground-surface" id="practice" aria-labelledby="practice-h">
        <div className="wrap">
          <div className="section-head practice-head">
            <h2 id="practice-h">{t("home.preview.title")}</h2>
            <p>{t("home.preview.description")}</p>
          </div>
          <div className="ui app app-frame" role="img" aria-label={t("home.preview.aria")} data-ui-pause-host>
            <div className="app__pane app__pane--list">
              <div className="ui-win">
                <div className="ui-win__bar">
                  <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span className="ui-win__crumb">{t("home.preview.breadcrumb")} <i>/</i> N5</span>
                  <span className="ui-spacer" />
                  <span className="ui-win__search" aria-hidden="true"><span className="ui-win__ph">{t("home.preview.search")}</span></span>
                </div>
                <div className="ui-win__body">
                  <nav className="ui-win__side" aria-label={t("home.preview.sections")}>
                    <span className="ui-win__nav is-on"><BookOpen size={14} aria-hidden="true" /> {t("home.preview.paper")}</span>
                    <span className="ui-win__nav"><Check size={14} aria-hidden="true" /> {t("home.preview.review")}</span>
                    <span className="ui-win__nav"><RotateCcw size={14} aria-hidden="true" /> {t("home.preview.mistakes")}</span>
                  </nav>
                  <div className="ui-win__main">
                    <div className="ui-win__cols" aria-hidden="true"><span>{t("home.preview.column.section")}</span><span>{t("home.preview.column.type")}</span><span>{t("home.preview.column.status")}</span></div>
                    <ul className="ui-win__rows">
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="1">語</span><span className="ui-win__who">{t("home.preview.vocabulary")}</span><span className="ui-win__sub">{t("home.preview.kanjiReading")}</span><span className="ui-win__st is-done">{t("home.preview.reviewed")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="2">字</span><span className="ui-win__who">{t("home.preview.vocabulary")}</span><span className="ui-win__sub">{t("home.preview.orthography")}</span><span className="ui-win__st is-done">{t("home.preview.reviewed")}</span></li>
                      <li className="ui-win__row is-active"><span className="ui-avatar" data-tone="3">文</span><span className="ui-win__who">{t("home.preview.vocabulary")}</span><span className="ui-win__sub">{t("home.preview.context")}</span><span className="ui-win__st is-you">{t("home.preview.open")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="4">語</span><span className="ui-win__who">{t("home.preview.vocabulary")}</span><span className="ui-win__sub">{t("home.preview.paraphrase")}</span><span className="ui-win__st">{t("home.preview.answered")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="5">文</span><span className="ui-win__who">{t("home.preview.grammar")}</span><span className="ui-win__sub">{t("home.preview.selectForm")}</span><span className="ui-win__st">{t("home.preview.answered")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="2">文</span><span className="ui-win__who">{t("home.preview.grammar")}</span><span className="ui-win__sub">{t("home.preview.sentenceBuilding")}</span><span className="ui-win__st">{t("home.preview.next")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="1">文</span><span className="ui-win__who">{t("home.preview.grammar")}</span><span className="ui-win__sub">{t("home.preview.textGrammar")}</span><span className="ui-win__st">{t("home.preview.next")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="4">読</span><span className="ui-win__who">{t("home.preview.reading")}</span><span className="ui-win__sub">{t("home.preview.shortPassage")}</span><span className="ui-win__st">{t("home.preview.next")}</span></li>
                      <li className="ui-win__row"><span className="ui-avatar" data-tone="3">聞</span><span className="ui-win__who">{t("home.preview.listening")}</span><span className="ui-win__sub">{t("home.preview.quickResponse")}</span><span className="ui-win__st">{t("home.preview.next")}</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="app__pane app__pane--open">
              <article className="review-window">
                <div className="review-window__bar">
                  <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span>{t("home.preview.answerReview")} <i>/</i> {t("home.preview.answerReviewContext")}</span>
                  <span className="review-window__state"><Check size={13} aria-hidden="true" /> {t("home.preview.reviewed")}</span>
                </div>
                <div className="review-window__body">
                  <p className="t-label">{t("home.preview.question")}</p>
                  <p className="review-window__prompt" lang="ja">まいあさ 6時に _____。</p>
                  <ul className="review-options" aria-label={t("home.preview.answerChoices")}>
                    <li><span className="review-options__letter">A</span><span>起きます</span><span className="review-options__mark"><Check size={15} aria-label={t("home.preview.correctAnswer")} /></span></li>
                    <li><span className="review-options__letter">B</span><span>寝ます</span></li>
                    <li><span className="review-options__letter">C</span><span>走ります</span></li>
                    <li><span className="review-options__letter">D</span><span>遊びます</span></li>
                  </ul>
                  <div className="review-explanation">
                    <div className="review-explanation__heading"><BookOpen size={15} aria-hidden="true" /><span>{t("home.preview.whyAnswerFits")}</span></div>
                    <p>{t("home.preview.explanation")}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="section ground-inverse review-section" id="review" aria-labelledby="review-h" data-moment="word-highlight">
        <div className="wrap">
          <div className="section-head">
            <h2 id="review-h">{t("home.steps.title")}</h2>
            <p className="mo-wh__text">{t("home.steps.description")}</p>
          </div>
          <div className="review-steps">
            <article className="review-step">
              <div className="review-step__visual"><Clock3 size={24} aria-hidden="true" /><span>{t("home.steps.timerVisual")}</span><span className="review-step__line" /></div>
              <div className="review-step__copy"><span className="step-num">01</span><h3>{t("home.steps.timedTitle")}</h3><p>{t("home.steps.timedDescription")}</p></div>
            </article>
            <article className="review-step">
              <div className="review-step__visual"><BookOpen size={24} aria-hidden="true" /><span>{t("home.steps.explanationVisual")}</span><span className="review-step__line" /></div>
              <div className="review-step__copy"><span className="step-num">02</span><h3>{t("home.steps.reviewTitle")}</h3><p>{t("home.steps.reviewDescription")}</p></div>
            </article>
            <article className="review-step">
              <div className="review-step__visual"><RotateCcw size={24} aria-hidden="true" /><span>{t("home.steps.practiceVisual")}</span><span className="review-step__line" /></div>
              <div className="review-step__copy"><span className="step-num">03</span><h3>{t("home.steps.practiceTitle")}</h3><p>{t("home.steps.practiceDescription")}</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="section levels-section" id="levels" aria-labelledby="levels-h">
        <div className="wrap">
          <div className="section-head levels-head">
            <h2 id="levels-h">{t("home.levels.title")}</h2>
            <p>{t("home.levels.description")} <a className="link" href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noreferrer">{t("home.levels.reference")}<ArrowUpRight size={14} aria-hidden="true" /></a></p>
          </div>
          <LevelFormatSelector />
        </div>
      </section>

      <section className="section ground-surface faq-section" id="questions" aria-labelledby="questions-h">
        <div className="wrap">
          <div className="section-head faq-head">
            <h2 id="questions-h">{t("home.checks.title")}</h2>
            <p>{t("home.checks.description")}</p>
          </div>
          <div className="question-layout">
            <div className="faq-list">
              <article className="faq-item">
                <h3>{t("home.checks.independentTitle")}</h3>
                <p>{t("home.checks.independentDescription")}</p>
              </article>
              <article className="faq-item">
                <h3>{t("home.checks.scoreTitle")}</h3>
                <p>{t("home.checks.scoreDescription")}</p>
              </article>
              <article className="faq-item">
                <h3>{t("home.checks.levelsTitle")}</h3>
                <p>{t("home.checks.levelsDescription")}</p>
              </article>
            </div>
            <div className="ui ui-panel content-review-preview" role="img" aria-label={t("home.checks.previewAria")}>
              <div className="content-review-preview__bar">
                <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                <span>{t("home.checks.previewBreadcrumb")} <i>/</i> N5</span>
                <span className="content-review-preview__tag">{t("home.checks.previewTag")}</span>
              </div>
              <div className="content-review-preview__body">
                <p className="t-label">{t("home.checks.beforePublication")}</p>
                <ul className="content-review-preview__rows">
                  <li><span>{t("home.checks.accuracy")}</span><span><Check size={14} aria-hidden="true" /> {t("home.checks.checked")}</span></li>
                  <li><span>{t("home.checks.levelAndType")}</span><span><Check size={14} aria-hidden="true" /> {t("home.checks.checked")}</span></li>
                  <li><span>{t("home.checks.rationale")}</span><span><Check size={14} aria-hidden="true" /> {t("home.checks.checked")}</span></li>
                  <li><span>{t("home.checks.rights")}</span><span className="content-review-preview__status-required">{t("home.checks.required")}</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
