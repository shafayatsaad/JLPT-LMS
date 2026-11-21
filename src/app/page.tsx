import Image from "next/image";
import { ArrowUpRight, BookOpen, Check, Clock3, RotateCcw } from "lucide-react";
import { LevelFormatSelector } from "@/components/level-format-selector";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero hero--split" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <p className="hero__kicker"><span className="dot" aria-hidden="true" />Independent JLPT practice</p>
                <h1 id="hero-h">JLPT mock exams for N1–N5</h1>
                <p className="hero__lead">Take timed papers, review each answer, and choose focused practice from a manually prepared question bank.</p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="#levels">Choose a JLPT level<ArrowUpRight size={16} aria-hidden="true" /></a>
                  <a className="btn btn--secondary" href="#practice">See a question review</a>
                </div>
              </div>
              <div className="hero__media span-6 start-7" aria-label="Origami Sakura tree hero image">
                {/* User-provided still. Replace this image element with the approved loop when the hero video is supplied. */}
                <Image
                  src="/hero/origami-sakura-tree.webp"
                  alt="A cherry blossom tree made from folded pink and ivory paper, with origami cranes and petals."
                  width={1536}
                  height={1024}
                  priority
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  data-source="client"
                  data-subject="origami Sakura tree"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="section ground-surface" id="practice" aria-labelledby="practice-h">
          <div className="wrap">
            <div className="section-head practice-head">
              <h2 id="practice-h">See the answer and its reasoning</h2>
              <p>After submission, the review pairs a selected answer with the correct choice and a written explanation.</p>
            </div>
            <div className="ui app app-frame" role="img" aria-label="JLPT N5 review screen: a vocabulary question, four answer choices, the correct answer, and its explanation." data-ui-pause-host>
              <div className="app__pane app__pane--list">
                <div className="ui ui-panel ui-win">
                  <div className="ui-win__bar">
                    <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                    <span className="ui-win__crumb">Practice <i>/</i> N5</span>
                    <span className="ui-spacer" />
                    <span className="ui-win__search" aria-hidden="true"><span className="ui-win__ph">Find a question</span></span>
                  </div>
                  <div className="ui-win__body">
                    <nav className="ui-win__side" aria-label="Practice sections">
                      <span className="ui-win__nav is-on"><BookOpen size={14} aria-hidden="true" /> Paper</span>
                      <span className="ui-win__nav"><Check size={14} aria-hidden="true" /> Review</span>
                      <span className="ui-win__nav"><RotateCcw size={14} aria-hidden="true" /> Mistakes</span>
                    </nav>
                    <div className="ui-win__main">
                      <div className="ui-win__cols" aria-hidden="true"><span>Section</span><span>Item type</span><span>Status</span></div>
                      <ul className="ui-win__rows">
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="1">語</span><span className="ui-win__who">Vocabulary</span><span className="ui-win__sub">Kanji reading</span><span className="ui-win__st is-done">Reviewed</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="2">字</span><span className="ui-win__who">Vocabulary</span><span className="ui-win__sub">Orthography</span><span className="ui-win__st is-done">Reviewed</span></li>
                        <li className="ui-win__row is-active"><span className="ui-avatar" data-tone="3">文</span><span className="ui-win__who">Vocabulary</span><span className="ui-win__sub">Context expression</span><span className="ui-win__st is-you">Open</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="4">語</span><span className="ui-win__who">Vocabulary</span><span className="ui-win__sub">Paraphrase</span><span className="ui-win__st">Answered</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="5">文</span><span className="ui-win__who">Grammar</span><span className="ui-win__sub">Select a form</span><span className="ui-win__st">Answered</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="2">文</span><span className="ui-win__who">Grammar</span><span className="ui-win__sub">Sentence composition</span><span className="ui-win__st">Next</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="1">文</span><span className="ui-win__who">Grammar</span><span className="ui-win__sub">Text grammar</span><span className="ui-win__st">Next</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="4">読</span><span className="ui-win__who">Reading</span><span className="ui-win__sub">Short passage</span><span className="ui-win__st">Next</span></li>
                        <li className="ui-win__row"><span className="ui-avatar" data-tone="3">聞</span><span className="ui-win__who">Listening</span><span className="ui-win__sub">Quick response</span><span className="ui-win__st">Next</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="app__pane app__pane--open">
                <article className="review-window">
                  <div className="review-window__bar">
                    <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                    <span>Answer review <i>/</i> N5 vocabulary</span>
                    <span className="review-window__state"><Check size={13} aria-hidden="true" /> Reviewed</span>
                  </div>
                  <div className="review-window__body">
                    <p className="t-label">Question preview</p>
                    <p className="review-window__prompt" lang="ja">まいあさ 6時に _____。</p>
                    <ul className="review-options" aria-label="Answer choices">
                      <li><span className="review-options__letter">A</span><span>起きます</span><span className="review-options__mark"><Check size={15} aria-label="Correct answer" /></span></li>
                      <li><span className="review-options__letter">B</span><span>寝ます</span></li>
                      <li><span className="review-options__letter">C</span><span>走ります</span></li>
                      <li><span className="review-options__letter">D</span><span>遊びます</span></li>
                    </ul>
                    <div className="review-explanation">
                      <div className="review-explanation__heading"><BookOpen size={15} aria-hidden="true" /><span>Why A fits</span></div>
                      <p>起きます means “wake up.” The sentence says the speaker wakes at six each morning.</p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="section ground-inverse review-section" id="review" data-moment="line-carries-colour" data-moment-opts='{"from":"base"}' aria-labelledby="review-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="review-h">Use mistakes to choose what to practise</h2>
              <p>Each completed paper leads to a review that points back to the skill behind an answer.</p>
            </div>
            <div className="review-steps">
              <article className="review-step">
                <div className="review-step__visual"><Clock3 size={24} aria-hidden="true" /><span>Section timer</span><span className="review-step__line" /></div>
                <div className="review-step__copy"><span className="step-num">01</span><h3>Take a timed paper</h3><p>Work through the level’s timed sections with saved answers and clear section transitions.</p></div>
              </article>
              <article className="review-step">
                <div className="review-step__visual"><BookOpen size={24} aria-hidden="true" /><span>Answer explanation</span><span className="review-step__line" /></div>
                <div className="review-step__copy"><span className="step-num">02</span><h3>Read each explanation</h3><p>Compare your answer with the key, then review why the distractors do not fit.</p></div>
              </article>
              <article className="review-step">
                <div className="review-step__visual"><RotateCcw size={24} aria-hidden="true" /><span>Targeted practice</span><span className="review-step__line" /></div>
                <div className="review-step__copy"><span className="step-num">03</span><h3>Return to missed skills</h3><p>Use question tags to build a focused set from reviewed content.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section className="section levels-section" id="levels" aria-labelledby="levels-h">
          <div className="wrap">
            <div className="section-head levels-head">
              <h2 id="levels-h">Choose your JLPT level</h2>
              <p>Check the official timed sections and how each level reports score categories.</p>
            </div>
            <LevelFormatSelector />
          </div>
        </section>

        <section className="section ground-surface faq-section" id="questions" aria-labelledby="questions-h">
          <div className="wrap">
            <div className="section-head faq-head">
              <h2 id="questions-h">Questions about JLPT practice</h2>
              <p>How the platform handles content, levels, and results.</p>
            </div>
            <div className="faq-list">
              <article className="faq-item">
                <h3>Is this an official JLPT platform?</h3>
                <p>No. This is an independent learning platform; the JLPT organizers do not operate or endorse it.</p>
              </article>
              <article className="faq-item">
                <h3>Are practice results official scores?</h3>
                <p>No. Results show raw performance on a mock paper. They do not reproduce the JLPT’s scaled score or predict a pass.</p>
              </article>
              <article className="faq-item">
                <h3>How are questions and explanations prepared?</h3>
                <p>Content is written in advance, checked for Japanese accuracy and level fit, and reviewed before it enters a published paper.</p>
              </article>
              <article className="faq-item">
                <h3>Which levels will the platform cover?</h3>
                <p>The launch scope is N1, N2, N3, N4, and N5. The selector above shows each level’s current JLPT section timings.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
