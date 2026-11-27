"use client";

import { useMemo, useState } from "react";
import styles from "@/components/selected-exam-preview.module.css";

export type SelectedPreviewAsset = { media_type: string; purpose: string; file_name: string | null; url: string | null; status?: string };
export type SelectedPreviewQuestion = {
  id: string;
  position: number;
  section_code: string;
  item_type_code: string;
  score_category_code: string;
  stimulus: unknown;
  prompt: unknown;
  options: Array<{ id: string; content?: unknown; text?: unknown }>;
  assets: SelectedPreviewAsset[];
};
export type SelectedPreviewSection = { code: string; duration_seconds: number; question_count: number };

function content(value: unknown): React.ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item, index) => <span key={index}>{content(item)}</span>);
  if (typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "line_break") return <br />;
  if (block.type === "ruby") return <ruby>{content(block.base ?? block.text)}<rt>{content(block.reading ?? block.rt)}</rt></ruby>;
  if (block.type === "blank") return <span className={styles.blank} aria-label="blank space for answer">（　　　）</span>;
  if (block.type === "emphasis") return <strong>{content(block.content ?? block.text)}</strong>;
  if ("content" in block) return content(block.content);
  if ("text" in block) return content(block.text);
  return Object.values(block).map((item, index) => <span key={index}>{content(item)}</span>);
}

function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function SelectedExamPreview({ formCode, level, version, status, title, directions, sections, questions }: {
  formCode: string;
  level: string;
  version: number;
  status: string;
  title: string;
  directions: string[];
  sections: SelectedPreviewSection[];
  questions: SelectedPreviewQuestion[];
}) {
  const [activeView, setActiveView] = useState("cover");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const activeSection = sections.find((section) => section.code === activeView);
  const activeQuestions = useMemo(() => activeSection ? questions.filter((question) => question.section_code === activeSection.code) : [], [activeSection, questions]);
  const answered = Object.keys(answers).length;
  const optionCount = questions.reduce((count, question) => count + question.options.length, 0);

  function mark(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  return <section className={`${styles.root} selected-exam-preview`} aria-label="Selected exam student preview">
    <div className={styles.disclosure}><strong>Preview mode · no timer · no answers saved</strong><span>These are the selected form’s current question revisions and media. Published forms stay frozen.</span></div>
    <header className={styles.header}><div><p>JLPT · {level} · {formCode} · v{version}</p><h2>{title}</h2><span className={styles.status}>{status.replaceAll("_", " ")}</span></div><div className={styles.time} aria-label="Section time preview"><strong>{activeSection ? clock(activeSection.duration_seconds) : "—:—"}</strong><span>sample section duration</span></div></header>
    <nav className={styles.nav} aria-label="Exam preview pages"><button type="button" aria-current={activeView === "cover" ? "page" : undefined} onClick={() => setActiveView("cover")}>Candidate page</button>{sections.map((section, index) => <button key={section.code} type="button" aria-current={activeView === section.code ? "page" : undefined} onClick={() => setActiveView(section.code)}>{index + 1}. {section.code} · {section.question_count}</button>)}<button type="button" aria-current={activeView === "answers" ? "page" : undefined} onClick={() => setActiveView("answers")}>Answer sheet · {answered}/{questions.length}</button></nav>
    <article className={styles.paper}>
      {activeView === "cover" ? <div className={styles.cover}>
        <p className={styles.paperKicker}>Candidate instructions</p><h3>{title}</h3><p className={styles.paperMeta}>{level} · {formCode} · Version {version}</p>
        <div className={styles.identity}><label>Candidate name<span /></label><label>Candidate number<span /></label><label>Examination date<span /></label></div>
        <h4>Before you begin</h4>{directions.length ? <ol>{directions.map((direction, index) => <li key={index}>{direction}</li>)}</ol> : <ol><li>Check the level and form code printed above.</li><li>Read each section’s instructions before answering.</li><li>Mark one answer for each question on the separate answer sheet.</li><li>Do not turn to the next section until instructed.</li></ol>}
        {!questions.length ? <p className={styles.empty}>This form does not contain any selected question revisions yet.</p> : null}
        <button className={styles.primary} type="button" onClick={() => setActiveView(sections[0]?.code ?? "answers")} disabled={!questions.length}>Open first section</button>
      </div> : null}
      {activeSection ? <div className={styles.section}>
        <header className={styles.sectionHeader}><p>SECTION · {sections.findIndex((section) => section.code === activeSection.code) + 1}</p><h3>{activeSection.code.replaceAll("-", " ")}</h3><div><span>{activeSection.question_count} questions</span><span>{Math.floor(activeSection.duration_seconds / 60)} minutes</span></div><p>Choose the best answer for each question. Use the separate answer sheet to mark your response.</p></header>
        {!activeQuestions.length ? <p className={styles.empty}>No questions are assigned to this section.</p> : activeQuestions.map((question) => <section className={styles.question} key={question.id}>
          <div className={styles.questionLabel}><strong>Question {question.position}</strong><span>{question.item_type_code.replaceAll("_", " ")}</span></div>
          {question.stimulus ? <div className={styles.stimulus}>{content(question.stimulus)}</div> : null}
          <div className={styles.prompt} lang="ja">{content(question.prompt)}</div>
          {question.assets.map((asset, index) => <div className={styles.media} key={`${asset.purpose}:${index}`}>{asset.status && !["approved", "eligible_for_exam"].includes(asset.status) ? <p className={styles.assetNotice}>Staff preview · {asset.status.replaceAll("_", " ")} media; learners will not receive this unapproved file.</p> : null}{asset.url ? asset.media_type.startsWith("audio/") ? <audio controls preload="metadata" src={asset.url}>Audio playback is not supported by this browser.</audio> : asset.media_type.startsWith("image/") ? <img src={asset.url} alt={asset.file_name ?? `Question ${question.position} image`} /> : <a href={asset.url} download={asset.file_name ?? undefined}>Open {asset.file_name ?? "attached asset"}</a> : <p className={styles.assetNotice}>The private file could not be previewed.</p>}</div>)}
          <ol className={styles.options} type="A">{question.options.map((option) => <li key={option.id}><span className={styles.optionBullet}>{option.id}</span><span lang="ja">{content(option.content ?? option.text)}</span></li>)}</ol>
        </section>)}
        <div className={styles.pageFooter}><span>{activeSection.code} · {activeQuestions.length} items</span><button type="button" onClick={() => setActiveView("answers")}>Go to answer sheet →</button></div>
      </div> : null}
      {activeView === "answers" ? <div className={styles.answerSheet}><div className={styles.answerTitle}><p className={styles.paperKicker}>Separate answer sheet</p><h3>{formCode}</h3><p>{level} · Preview answers are temporary and are not saved.</p></div><div className={styles.identity}><label>Candidate name<span /></label><label>Candidate number<span /></label></div>
        {!questions.length ? <p className={styles.empty}>The answer sheet appears after questions are added to this form.</p> : sections.map((section) => <section className={styles.answerSection} key={section.code}><h4>{section.code.replaceAll("-", " ")}</h4>{questions.filter((question) => question.section_code === section.code).map((question) => <fieldset className={styles.answerRow} key={question.id}><legend><span>{question.position}</span><span className={styles.srOnly}>Question {question.position}</span></legend><div>{question.options.map((option) => <label key={option.id} title={`Question ${question.position}, choice ${option.id}`}><input type="radio" name={`preview-${question.id}`} value={option.id} checked={answers[question.id] === option.id} onChange={() => mark(question.id, option.id)} /><span>{option.id}</span></label>)}</div></fieldset>)}</section>)}
        <div className={styles.pageFooter}><span>{answered} of {questions.length} answered · {optionCount} choice bubbles</span><button type="button" onClick={() => setActiveView(sections[0]?.code ?? "cover")}>Return to booklet →</button></div>
      </div> : null}
    </article>
  </section>;
}
