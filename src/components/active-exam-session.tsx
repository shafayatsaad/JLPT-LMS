"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock3, Flag, Headphones, Play, Send, WifiOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { SignOutButton } from "@/components/sign-out-button";
import type { MessageKey } from "@/lib/i18n";

type ExamOption = { id: string; content?: unknown; text?: unknown };
type ExamQuestion = {
  form_item_id: string;
  question_id: string;
  position: number;
  section_code: string;
  item_type_code: string;
  stimulus?: unknown;
  prompt: unknown;
  options: ExamOption[];
  selected_option_id: string | null;
  is_flagged: boolean;
};
type StoredPendingAnswer = { form_item_id: string; selected_option_id: string | null };
type AttemptSection = {
  section_code: string;
  section_order: number;
  status: "locked" | "active" | "completed" | "expired";
  deadline_at: string | null;
  duration_seconds: number;
};
export type ExamAttemptPayload = {
  attempt: {
    id: string;
    level: string;
    status: "in_progress" | "submitted" | "expired";
    started_at: string;
    deadline_at: string;
    form_code: string;
    version: string;
    preparation_required: boolean;
    preparation_started_at: string | null;
    preparation_deadline_at: string | null;
    candidate_name: string | null;
    candidate_number: string | null;
  };
  active_section: {
    section_code: string;
    section_order: number;
    deadline_at: string;
    duration_seconds: number;
  } | null;
  sections: AttemptSection[];
  questions: ExamQuestion[];
  assets: Array<{ question_id: string; purpose: string; media_type: string; storage_path: string; duration_seconds: number | null; play_count: number; recovery_used: boolean; playback_completed_at: string | null }>;
};

function ListeningAudioPlayer({ asset, src, attemptId, t }: {
  asset: ExamAttemptPayload["assets"][number];
  src: string;
  attemptId: string;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackStarted = useRef(false);
  const [status, setStatus] = useState<"ready" | "claiming" | "playing" | "played" | "recovery">(() =>
    asset.playback_completed_at ? "played" : asset.play_count > 0 ? "recovery" : "ready",
  );
  const [message, setMessage] = useState<MessageKey | null>(null);

  async function play(recovery: boolean) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !audioRef.current) {
      setMessage("exam.errorConfig");
      return;
    }
    setMessage(null);
    setStatus("claiming");
    const { data, error: claimError } = await supabase.rpc("claim_exam_audio_playback", {
      p_attempt_id: attemptId,
      p_storage_path: asset.storage_path,
      p_recovery: recovery,
    });
    if (claimError || data !== true) {
      setStatus("played");
      setMessage("exam.audioRecoveryUnavailable");
      return;
    }
    playbackStarted.current = true;
    try {
      await audioRef.current.play();
      setStatus("playing");
    } catch {
      setStatus("recovery");
      setMessage("exam.audioFailure");
    }
  }

  async function complete() {
    setStatus("played");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const args = { p_attempt_id: attemptId, p_storage_path: asset.storage_path };
    const firstSave = await supabase.rpc("complete_exam_audio_playback", args);
    if (firstSave.error) await supabase.rpc("complete_exam_audio_playback", args);
  }

  function failed() {
    if (!playbackStarted.current) return;
    playbackStarted.current = false;
    setStatus("recovery");
    setMessage("exam.audioFailure");
  }

  const recovery = status === "recovery" && asset.play_count < 2 && !asset.recovery_used && !asset.playback_completed_at;
  const disabled = status === "claiming" || status === "playing" || status === "played" || (!recovery && status !== "ready");
  return <div className="exam-question-media exam-question-media--listening">
    <span><Headphones size={15} aria-hidden="true" /> {t("exam.listeningAudio")}</span>
    <button className="exam-audio-start" type="button" disabled={disabled} onClick={() => void play(recovery)}>
      <Play size={14} aria-hidden="true" /> {status === "ready" ? t("exam.playListening") : status === "claiming" ? t("exam.audioChecking") : recovery ? t("exam.retryListening") : status === "playing" ? t("exam.audioPlaying") : t("exam.audioPlayed")}
    </button>
    {message ? <p role="status">{t(message)}</p> : null}
    <audio ref={audioRef} className="exam-audio-engine" aria-hidden="true" preload="auto" src={src} onEnded={() => void complete()} onError={failed} />
  </div>;
}

function ExamAnswerSheet({ questions, t, onSelect, disabled }: {
  questions: ExamQuestion[];
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  onSelect: (question: ExamQuestion, optionId: string, index: number) => void;
  disabled: boolean;
}) {
  return <aside className="exam-answer-sheet" aria-label={t("exam.answerSheet")}>
    <p>{t("exam.answerSheet")}</p>
    <div className="exam-answer-sheet__rows">{questions.map((question, index) => <div className="exam-answer-sheet__row" key={question.form_item_id}>
      <span className="exam-answer-sheet__number">{String(question.position).padStart(2, "0")}</span>
      <div className="exam-answer-sheet__bubbles" role="group" aria-label={t("exam.question", { number: question.position })}>
        {question.options.map((option) => <button className={question.selected_option_id === option.id ? "is-selected" : ""} type="button" key={option.id} disabled={disabled} aria-pressed={question.selected_option_id === option.id} aria-label={`${t("exam.question", { number: question.position })} · ${t("exam.selectAnswerOption", { option: option.id })}`} onClick={() => onSelect(question, option.id, index)}><span>{option.id}</span></button>)}
      </div>
      {question.is_flagged ? <Flag size={13} aria-label={t("exam.flagged")} /> : null}
    </div>)}</div>
  </aside>;
}

function content(value: unknown): React.ReactNode {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part, index) => <span key={index}>{content(part)}</span>);
  if (!value || typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "ruby") return <ruby>{content(block.base ?? block.text)}<rt>{content(block.reading ?? block.rt)}</rt></ruby>;
  if (block.type === "line_break") return <br />;
  if (block.type === "image" && typeof block.url === "string" && /^https?:\/\//.test(block.url)) {
    return <img className="exam-content-image" src={block.url} alt={String(block.alt ?? "Question image")} />;
  }
  if ("content" in block) return content(block.content);
  if ("text" in block) return content(block.text);
  return null;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");
  return hours ? `${hours.toString().padStart(2, "0")}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

function secondsUntil(deadline: string | null | undefined) {
  if (!deadline) return 0;
  const timestamp = Date.parse(deadline);
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : 0;
}

function label(value: string, translate: (key: MessageKey, values?: Record<string, string | number>) => string, level?: string) {
  const normalized = value.toLowerCase().replaceAll("-", "_");
  if (normalized === "vocabulary" && (level === "N4" || level === "N5")) return translate("exam.section.language_knowledge_vocabulary");
  if (normalized === "grammar_reading" && (level === "N4" || level === "N5")) return translate("exam.section.language_knowledge_grammar_reading");
  const knownLabels: Record<string, MessageKey> = {
    active: "exam.status.active",
    completed: "exam.status.completed",
    expired: "exam.status.expired",
    locked: "exam.status.locked",
    language_knowledge_vocabulary: "exam.section.language_knowledge_vocabulary",
    language_knowledge_grammar_reading: "exam.section.language_knowledge_grammar_reading",
    language_knowledge_reading: "exam.section.language_knowledge_reading",
    grammar_reading: "exam.section.grammar_reading",
    listening: "exam.section.listening",
    vocabulary: "exam.section.vocabulary",
    grammar: "exam.section.grammar",
    reading: "exam.section.reading",
    kanji_reading: "exam.item.kanjiReading",
    orthography: "exam.item.orthography",
    word_formation: "exam.item.wordFormation",
    contextual_expressions: "exam.item.contextualExpressions",
    paraphrases: "exam.item.paraphrases",
    usage: "exam.item.usage",
    sentential_grammar_form: "exam.item.sententialGrammarForm",
    sentence_composition: "exam.item.sentenceComposition",
    text_grammar: "exam.item.textGrammar",
    short_passages: "exam.item.shortPassages",
    mid_size_passages: "exam.item.midSizePassages",
    long_passages: "exam.item.longPassages",
    integrated_comprehension: "exam.item.integratedComprehension",
    thematic_comprehension: "exam.item.thematicComprehension",
    information_retrieval: "exam.item.informationRetrieval",
    task_based_comprehension: "exam.item.taskBasedComprehension",
    key_points: "exam.item.keyPoints",
    general_outline: "exam.item.generalOutline",
    verbal_expressions: "exam.item.verbalExpressions",
    quick_response: "exam.item.quickResponse",
    listening_integrated_comprehension: "exam.item.listeningIntegratedComprehension",
  };
  const key = knownLabels[normalized];
  return key ? translate(key) : value.replaceAll("_", " ").replaceAll("-", " ");
}

export function ActiveExamSession({ initialPayload }: { initialPayload: ExamAttemptPayload }) {
  const { t } = useLocale();
  const router = useRouter();
  const [payload, setPayload] = useState(initialPayload);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => secondsUntil(initialPayload.active_section?.deadline_at));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "notSaved">("saved");
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [online, setOnline] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState(false);
  const [hasUnsavedAnswers, setHasUnsavedAnswers] = useState(false);
  const [candidateName, setCandidateName] = useState(initialPayload.attempt.candidate_name ?? "");
  const [candidateNumber, setCandidateNumber] = useState(initialPayload.attempt.candidate_number ?? "");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingAnswers = useRef(new Map<string, { question: ExamQuestion; selectedOptionId: string | null }>());
  const pendingStorageKey = `jlpt-exam-pending-answers:${initialPayload.attempt.id}`;
  const timedOutKey = useRef("");
  const activeSection = payload.active_section;
  const candidateCover = payload.attempt.preparation_required && !payload.attempt.preparation_started_at;
  const preparationActive = payload.attempt.preparation_required && Boolean(payload.attempt.preparation_started_at) && !activeSection;
  const answeredCount = payload.questions.filter((question) => Boolean(question.selected_option_id)).length;
  const flaggedCount = payload.questions.filter((question) => question.is_flagged).length;
  const finished = !activeSection && !candidateCover && !preparationActive && payload.attempt.status === "in_progress";

  function persistPendingAnswers() {
    try {
      if (!pendingAnswers.current.size) {
        window.sessionStorage.removeItem(pendingStorageKey);
        return;
      }
      const stored: StoredPendingAnswer[] = Array.from(pendingAnswers.current.values(), ({ question, selectedOptionId }) => ({
        form_item_id: question.form_item_id,
        selected_option_id: selectedOptionId,
      }));
      window.sessionStorage.setItem(pendingStorageKey, JSON.stringify(stored));
    } catch {
      // Storage may be unavailable in private browsing; server writes still run.
    }
  }

  function mergePendingAnswers(next: ExamAttemptPayload) {
    if (!pendingAnswers.current.size) return next;
    return {
      ...next,
      questions: next.questions.map((question) => {
        const pending = pendingAnswers.current.get(question.form_item_id);
        return pending ? { ...question, selected_option_id: pending.selectedOptionId } : question;
      }),
    };
  }

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(pendingStorageKey);
        if (!raw) return;
        const stored = JSON.parse(raw) as StoredPendingAnswer[];
        if (!Array.isArray(stored)) throw new Error("Invalid pending answer data");
        const questions = new Map(initialPayload.questions.map((question) => [question.form_item_id, question]));
        const restored = new Map<string, { question: ExamQuestion; selectedOptionId: string | null }>();
        for (const answer of stored) {
          if (!answer || typeof answer.form_item_id !== "string") continue;
          const question = questions.get(answer.form_item_id);
          if (!question) continue;
          if (answer.selected_option_id !== null && !question.options.some((option) => option.id === answer.selected_option_id)) continue;
          restored.set(question.form_item_id, { question, selectedOptionId: answer.selected_option_id });
        }
        if (!restored.size) {
          window.sessionStorage.removeItem(pendingStorageKey);
          return;
        }
        pendingAnswers.current = restored;
        setPayload((current) => mergePendingAnswers(current));
        setHasUnsavedAnswers(true);
        setSaveState("notSaved");
      } catch {
        try { window.sessionStorage.removeItem(pendingStorageKey); } catch { /* Storage remains optional. */ }
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [initialPayload, pendingStorageKey]);

  useEffect(() => {
    function setOnlineStatus() { setOnline(navigator.onLine); }
    setOnlineStatus();
    window.addEventListener("online", setOnlineStatus);
    window.addEventListener("offline", setOnlineStatus);
    return () => {
      window.removeEventListener("online", setOnlineStatus);
      window.removeEventListener("offline", setOnlineStatus);
    };
  }, []);

  async function reloadAttempt() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("exam.errorConfig");
      return;
    }
    const { data, error: loadError } = await supabase.rpc("get_exam_attempt_payload", { p_attempt_id: payload.attempt.id });
    if (loadError || !data) {
      setError("exam.errorLoad");
      return;
    }
    const next = data as ExamAttemptPayload;
    setPayload(mergePendingAnswers(next));
    setCandidateName(next.attempt.candidate_name ?? "");
    setCandidateNumber(next.attempt.candidate_number ?? "");
    setSelectedIndex(0);
    if (["submitted", "expired"].includes(next.attempt.status)) router.replace(`/results/${next.attempt.id}`);
  }

  useEffect(() => {
    const deadline = activeSection?.deadline_at ?? (preparationActive ? payload.attempt.preparation_deadline_at : null);
    if (!deadline) return;
    const attemptKey = `${payload.attempt.id}:${activeSection?.section_code ?? "preparation"}:${deadline}`;
    const update = () => {
      const seconds = secondsUntil(deadline);
      setRemaining(seconds);
      if (seconds === 0 && timedOutKey.current !== attemptKey) {
        timedOutKey.current = attemptKey;
        window.setTimeout(() => void reloadAttempt(), 250);
      }
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
    // reloadAttempt is intentionally rebound to the current payload after the
    // deadline; including it would restart the interval after each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection?.section_code, activeSection?.deadline_at, payload.attempt.preparation_deadline_at, preparationActive, payload.attempt.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadMedia() {
      if (!payload.assets.length) {
        setMediaUrls({});
        setMediaError(false);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const entries = await Promise.all(payload.assets.map(async (asset) => {
        // Cover the longest official single section (110 minutes) with a small
        // playback buffer so listening media does not expire mid-exam.
        const { data, error: signedError } = await supabase.storage.from("jlpt-question-assets").createSignedUrl(asset.storage_path, 7200);
        return [asset.storage_path, signedError ? "" : data?.signedUrl ?? ""] as const;
      }));
      if (cancelled) return;
      setMediaUrls(Object.fromEntries(entries));
      setMediaError(entries.some(([, url]) => !url));
    }
    void loadMedia();
    return () => { cancelled = true; };
  }, [payload.assets]);

  async function saveAnswer(question: ExamQuestion, selectedOptionId: string | null) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("exam.errorConfig");
    setPayload((current) => ({ ...current, questions: current.questions.map((item) => item.form_item_id === question.form_item_id ? { ...item, selected_option_id: selectedOptionId } : item) }));
    pendingAnswers.current.set(question.form_item_id, { question, selectedOptionId });
    persistPendingAnswers();
    setHasUnsavedAnswers(true);
    setSaveState("saving");
    setError(null);
    const write = saveQueue.current.catch(() => undefined).then(async () => {
      const { error: saveError } = await supabase.rpc("save_exam_answer", {
        p_attempt_id: payload.attempt.id,
        p_form_item_id: question.form_item_id,
        p_selected_option_id: selectedOptionId,
        p_time_spent_seconds: 0,
      });
      if (saveError) throw saveError;
      const pending = pendingAnswers.current.get(question.form_item_id);
      if (pending?.selectedOptionId === selectedOptionId) pendingAnswers.current.delete(question.form_item_id);
      persistPendingAnswers();
    });
    saveQueue.current = write;
    try {
      await write;
      setSaveState("saved");
      setHasUnsavedAnswers(pendingAnswers.current.size > 0);
    } catch {
      setSaveState("notSaved");
      setError("exam.errorSave");
    }
  }

  async function toggleFlag(question: ExamQuestion) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("exam.errorConfig");
    const flagged = !question.is_flagged;
    setPayload((current) => ({ ...current, questions: current.questions.map((item) => item.form_item_id === question.form_item_id ? { ...item, is_flagged: flagged } : item) }));
    const { error: flagError } = await supabase.rpc("set_exam_answer_flag", {
      p_attempt_id: payload.attempt.id,
      p_form_item_id: question.form_item_id,
      p_is_flagged: flagged,
    });
    if (flagError) {
      setError("exam.errorFlag");
      void reloadAttempt();
    }
  }

  async function advanceSection() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("exam.errorConfig"); return; }
    if (busy) return;
    setBusy(true);
    setError(null);
    await saveQueue.current.catch(() => undefined);
    if (pendingAnswers.current.size > 0) {
      setError("exam.unsavedBeforeAdvance");
      setBusy(false);
      return;
    }
    const { error: advanceError } = await supabase.rpc("advance_exam_section", { p_attempt_id: payload.attempt.id });
    if (advanceError) setError("exam.errorAdvance");
    else await reloadAttempt();
    setBusy(false);
  }

  async function submitAttempt() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("exam.errorConfig"); return; }
    if (busy) return;
    setBusy(true);
    setError(null);
    await saveQueue.current.catch(() => undefined);
    if (pendingAnswers.current.size > 0) {
      setError("exam.unsavedBeforeSubmit");
      setBusy(false);
      return;
    }
    const { data, error: submitError } = await supabase.rpc("submit_exam_attempt", { p_attempt_id: payload.attempt.id });
    if (submitError) {
      setError("exam.errorSubmit");
      setBusy(false);
      return;
    }
    router.replace(`/results/${String(data ?? payload.attempt.id)}`);
    router.refresh();
  }

  async function beginPreparation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("exam.errorConfig"); return; }
    if (!candidateName.trim()) { setError("exam.candidateNameRequired"); return; }
    setBusy(true);
    setError(null);
    const { error: preparationError } = await supabase.rpc("begin_exam_preparation", {
      p_attempt_id: payload.attempt.id,
      p_candidate_name: candidateName.trim(),
      p_candidate_number: candidateNumber.trim() || null,
    });
    setBusy(false);
    if (preparationError) {
      setError("exam.errorPrep");
      return;
    }
    await reloadAttempt();
  }

  async function retryUnsavedAnswers() {
    const pending = Array.from(pendingAnswers.current.values());
    for (const answer of pending) await saveAnswer(answer.question, answer.selectedOptionId);
  }

  const unanswered = payload.questions.length - answeredCount;

  function focusQuestion(index: number) {
    setSelectedIndex(index);
    window.requestAnimationFrame(() => document.getElementById(`exam-question-${payload.questions[index]?.form_item_id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectFromAnswerSheet(question: ExamQuestion, optionId: string, index: number) {
    focusQuestion(index);
    void saveAnswer(question, optionId);
  }

  return (
    <div className="exam-shell active-exam-shell">
      <a className="skip-link" href="#exam-content">{t("common.skip")}</a>
      <header className="exam-topbar">
        <Link className="exam-topbar__brand" href="/dashboard"><span aria-hidden="true">JLPT</span><strong>{t("exam.workspace")}</strong></Link>
        <p>JLPT {payload.attempt.level} · {payload.attempt.form_code} · {t("exam.form")} {payload.attempt.version}</p>
        <LanguageSwitch compact />
        <div className="exam-topbar__account-actions"><Link className="exam-topbar__exit" href="/dashboard">{t("exam.exitDashboard")}</Link><SignOutButton className="exam-topbar__signout" /></div>
      </header>
      <main className="exam-main" id="exam-content" tabIndex={-1}>
        <div className="exam-workspace">
          <div className="exam-workspace__head">
            <div><span className="exam-kicker">{candidateCover ? t("exam.candidateStep") : preparationActive ? t("exam.preparationStep") : activeSection ? t("exam.timedSection", { order: activeSection.section_order }) : t("exam.reviewSection")}</span><h1>{candidateCover ? t("exam.candidateTitle") : preparationActive ? t("exam.preparationTitle") : activeSection ? label(activeSection.section_code, t, payload.attempt.level) : t("exam.readySubmit")}</h1><p>{candidateCover ? t("exam.candidateLede") : preparationActive ? t("exam.preparationLede") : t("exam.answerProgress", { answered: answeredCount, total: payload.questions.length, flagged: flaggedCount })}</p></div>
            {activeSection || preparationActive ? <div className="exam-clock" role="timer" aria-live="off" aria-label={t("exam.remaining", { time: formatTime(remaining) })}><Clock3 size={17} aria-hidden="true" /><span>{formatTime(remaining)}</span><small>{activeSection ? t("exam.sectionTime") : t("exam.preparationTime")}</small></div> : null}
          </div>
          {!online ? <div className="exam-preview-banner exam-preview-banner--offline" role="status"><WifiOff size={15} aria-hidden="true" /> {t("exam.offline")}</div> : null}
          {!candidateCover && !preparationActive && payload.sections.length > 0 ? <div className="exam-progress" aria-label={t("exam.sections")}>{payload.sections.map((section) => <div className={`exam-progress__section ${section.status === "active" ? "is-active" : ""} ${section.status === "completed" ? "is-answered" : ""}`} key={section.section_code} aria-current={section.status === "active" ? "step" : undefined}><span className="exam-progress__index">{String(section.section_order).padStart(2, "0")}</span><span className="exam-progress__name">{label(section.section_code, t, payload.attempt.level)}</span><span className="exam-progress__time">{label(section.status, t)}</span></div>)}</div> : null}

          {candidateCover ? <form className="exam-cover-paper" onSubmit={(event) => void beginPreparation(event)}>
            <header className="exam-paper__header"><div><p>{t("exam.candidateCover")}</p><strong>Japanese-Language Proficiency Test · {payload.attempt.level}</strong></div><span>{payload.attempt.form_code} · {t("exam.form")} {payload.attempt.version}</span></header>
            <div className="exam-cover-title"><span>{t("exam.candidateStep")}</span><h2>{t("exam.candidateTitle")}</h2><p>{t("exam.candidateLede")}</p></div>
            <div className="exam-cover-fields">
              <label>{t("exam.candidateName")}<input autoComplete="name" required maxLength={120} value={candidateName} onChange={(event) => setCandidateName(event.target.value)} /></label>
              <label>{t("exam.candidateNumber")} <span>{t("exam.optional")}</span><input maxLength={60} value={candidateNumber} onChange={(event) => setCandidateNumber(event.target.value)} /></label>
            </div>
            <dl className="exam-cover-facts"><div><dt>{t("exam.level")}</dt><dd>{payload.attempt.level}</dd></div><div><dt>{t("exam.form")}</dt><dd>{payload.attempt.form_code} · {payload.attempt.version}</dd></div></dl>
            <div className="exam-paper__directions"><strong>{t("exam.instructions")}</strong><p>{t("exam.candidateInstructions")}</p></div>
            <button className="exam-control" type="submit" disabled={busy}>{busy ? t("exam.preparationStarting") : t("exam.beginPreparation")} <ArrowRight size={16} aria-hidden="true" /></button>
          </form> : preparationActive ? <section className="exam-preparation-panel">
            <div className="exam-paper__header"><div><p>{t("exam.candidateCover")}</p><strong>Japanese-Language Proficiency Test · {payload.attempt.level}</strong></div><span>{payload.attempt.form_code} · {t("exam.form")} {payload.attempt.version}</span></div>
            <h2>{t("exam.preparationTitle")}</h2><p>{t("exam.preparationInstructions")}</p>
            <dl className="exam-cover-facts"><div><dt>{t("exam.candidateName")}</dt><dd>{payload.attempt.candidate_name}</dd></div>{payload.attempt.candidate_number ? <div><dt>{t("exam.candidateNumber")}</dt><dd>{payload.attempt.candidate_number}</dd></div> : null}</dl>
            <p className="exam-preparation-notice">{t("exam.preparationNotice")}</p>
          </section> : payload.questions.length > 0 && activeSection ? <div className="exam-question-layout">
            <aside className="exam-question-rail" aria-label={t("exam.sectionQuestions")}>
              <p>{t("exam.sectionQuestionsHeading")}</p>
              {payload.questions.map((question, index) => <button type="button" key={question.form_item_id} className={`exam-question-rail__item ${selectedIndex === index ? "is-active" : ""} ${question.selected_option_id ? "is-answered" : ""}`} onClick={() => focusQuestion(index)} aria-current={selectedIndex === index ? "step" : undefined}><span>{String(question.position).padStart(2, "0")}</span>{t("exam.question", { number: question.position })}{question.selected_option_id ? <Check size={14} aria-label={t("exam.answered")} /> : null}{question.is_flagged ? <Flag size={13} aria-label={t("exam.flagged")} /> : null}</button>)}
            </aside>
            <section className="exam-question-panel exam-paper" aria-label={`${label(activeSection.section_code, t, payload.attempt.level)} question paper`}>
              <header className="exam-paper__header"><div><p>Japanese-Language Proficiency Test · {payload.attempt.level}</p><strong>{label(activeSection.section_code, t, payload.attempt.level)}</strong></div><span>{payload.attempt.form_code} · {payload.attempt.version}</span></header>
              <div className="exam-paper__candidate"><div><span>{t("exam.candidateName")}</span><strong>{payload.attempt.candidate_name || "—"}</strong></div>{payload.attempt.candidate_number ? <div><span>{t("exam.candidateNumber")}</span><strong>{payload.attempt.candidate_number}</strong></div> : null}</div>
              <div className="exam-paper__directions"><strong>{t("exam.instructions")}</strong><p>{t("exam.paperInstructions")}</p></div>
              {payload.questions.map((question, index) => {
                const questionMedia = payload.assets.filter((asset) => asset.question_id === question.question_id);
                return <article className={`exam-paper__question ${selectedIndex === index ? "is-active" : ""}`} id={`exam-question-${question.form_item_id}`} key={question.form_item_id} onFocus={() => setSelectedIndex(index)}>
                  <div className="exam-question-panel__meta"><span>{label(question.item_type_code, t)}</span><span>{t("exam.questionPosition", { current: question.position, total: payload.questions.length })}</span></div>
                  {question.stimulus ? <div className="exam-question-stimulus" lang="ja">{content(question.stimulus)}</div> : null}
                  <div className="exam-question-rich-content" lang="ja">{content(question.prompt)}</div>
                  {questionMedia.map((asset) => {
                    const url = mediaUrls[asset.storage_path];
                    if (!url) return null;
                    return asset.media_type.startsWith("audio/") ? <ListeningAudioPlayer asset={asset} attemptId={payload.attempt.id} key={asset.storage_path} src={url} t={t} /> : asset.media_type.startsWith("image/") ? <img className="exam-question-asset-image" key={asset.storage_path} src={url} alt={t("exam.questionImage")} /> : null;
                  })}
                  {mediaError ? <p className="exam-save-state" role="status">{t("exam.mediaUnavailable")}</p> : null}
                  <fieldset className="exam-answer-list">
                    <legend className="sr-only">{t("exam.question", { number: index + 1 })} · {t("exam.chooseAnswer")}</legend>
                    {question.options.map((option) => <label className={`exam-answer-option ${question.selected_option_id === option.id ? "is-selected" : ""}`} key={option.id}><input type="radio" name={question.form_item_id} value={option.id} checked={question.selected_option_id === option.id} disabled={busy || remaining <= 0} onChange={() => void saveAnswer(question, option.id)} /><span className="exam-answer-option__letter">{option.id}</span><span lang="ja">{content(option.content ?? option.text)}</span></label>)}
                  </fieldset>
                  <button className={`exam-finish-link exam-paper__flag ${question.is_flagged ? "is-flagged" : ""}`} type="button" disabled={busy || remaining <= 0} onClick={() => void toggleFlag(question)}><Flag size={14} aria-hidden="true" /> {question.is_flagged ? t("exam.unflag") : t("exam.flagForReview")}</button>
                </article>;
              })}
              <p className="exam-save-state" aria-live="polite">{online ? t("exam.answerStatus", { status: t(`exam.${saveState}` as MessageKey) }) : t("exam.offlineHeld")}</p>
              {hasUnsavedAnswers ? <button className="exam-finish-link" type="button" disabled={!online || busy} onClick={() => void retryUnsavedAnswers()}>{t("exam.retrySave")}</button> : null}
              <div className="exam-question-panel__footer active-exam-footer"><span>{t("exam.answerProgress", { answered: answeredCount, total: payload.questions.length, flagged: flaggedCount })}</span><button className="exam-control" type="button" disabled={busy} onClick={() => void advanceSection()}>{busy ? t("exam.savingSection") : t("exam.finishSection")} <ArrowRight size={16} aria-hidden="true" /></button></div>
            </section>
            <ExamAnswerSheet questions={payload.questions} t={t} onSelect={selectFromAnswerSheet} disabled={busy || remaining <= 0} />
          </div> : <section className="exam-finish-panel">
            <h2>{finished ? t("exam.reviewAttempt") : t("exam.attemptClosed")}</h2>
            {finished ? <><p>{t("exam.finishSummary", { answered: answeredCount, unanswered, flagged: flaggedCount })}</p>{confirmSubmit ? <div className="exam-submit-confirm" role="group" aria-label={t("exam.confirmGroup")}><p>{t("exam.submitWarning")}</p><button className="exam-control" type="button" disabled={busy} onClick={() => void submitAttempt()}>{busy ? t("exam.submitting") : t("exam.confirmSubmission")} <Send size={15} aria-hidden="true" /></button><button className="exam-control exam-control--quiet" type="button" disabled={busy} onClick={() => setConfirmSubmit(false)}>{t("exam.continueReviewing")}</button></div> : <button className="exam-control" type="button" onClick={() => setConfirmSubmit(true)}>{t("exam.reviewSubmit")} <Send size={15} aria-hidden="true" /></button>}</> : <p>{t("exam.loadingStatus")}</p>}
          </section>}
          {confirmSubmit && activeSection ? <div className="exam-submit-confirm" role="group" aria-label={t("exam.confirmEarlyGroup")}><p>{t("exam.submitWarning")} {t("exam.unansweredEarly", { count: unanswered })}</p><button className="exam-control" type="button" disabled={busy} onClick={() => void submitAttempt()}>{busy ? t("exam.submitting") : t("exam.confirmSubmission")} <Send size={15} aria-hidden="true" /></button><button className="exam-control exam-control--quiet" type="button" disabled={busy} onClick={() => setConfirmSubmit(false)}>{t("exam.keepWorking")}</button></div> : null}
          {error ? <p className="exam-error" role="alert">{t(error)}</p> : null}
          {activeSection && payload.questions.length > 0 ? <button className="exam-finish-link" type="button" onClick={() => setConfirmSubmit(true)}>{t("exam.earlySubmit")}</button> : null}
        </div>
      </main>
    </div>
  );
}
