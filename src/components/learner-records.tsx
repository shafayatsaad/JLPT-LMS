"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";

type PublishedExam = {
  id: string;
  level: string;
  form_code: string;
  version: number;
  published_at: string | null;
};

type AttemptRow = {
  id: string;
  level: string;
  status: string;
  created_at: string;
};

type RawResultRow = {
  attempt_id: string;
  raw_correct: number;
  raw_incorrect: number;
  raw_unanswered: number;
};

function formatDate(value: string, language: "en" | "bn", timeZone: string, dateStyle: "medium" | "long" = "medium") {
  const locale = language === "bn" ? "bn-BD" : "en";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle, timeZone: "UTC" }).format(date);
  }
}

function formatCount(value: number, language: "en" | "bn") {
  return new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en").format(value);
}

function attemptStatusKey(status: string): MessageKey | null {
  if (status === "in_progress") return "common.inProgress";
  if (status === "submitted") return "common.submitted";
  if (status === "expired") return "common.expired";
  if (status === "created") return "common.pending";
  return null;
}

export function ExamLibraryCards({ forms, timeZone }: { forms: PublishedExam[]; timeZone: string }) {
  const { language, t } = useLocale();
  return (
    <div className="exam-library-grid">
      {forms.map((form) => (
        <article className="exam-library-card" key={form.id}>
          <span className="product-small-label">{t("exams.formLabel", { level: form.level, version: formatCount(form.version, language) })}</span>
          <h3>{form.form_code}</h3>
          <p>{form.published_at ? t("exams.publishedDate", { date: formatDate(form.published_at, language, timeZone) }) : t("exams.publishedForm")}</p>
          <Link className="text-link" href={`/exams/${form.id}`}>{t("exams.details")} <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </article>
      ))}
    </div>
  );
}

export function ExamPublicationInfo({ accessTier, publishedAt, timeZone }: { accessTier: string; publishedAt: string | null; timeZone: string }) {
  const { language, t } = useLocale();
  const tier = accessTier === "free" ? t("examDetails.free") : t("examDetails.premium");
  const published = publishedAt
    ? t("examDetails.published", { date: formatDate(publishedAt, language, timeZone, "long") })
    : t("examDetails.dateUnavailable");
  return <p>{t("examDetails.access", { tier })} · {published}</p>;
}

export function ProgressAttemptsTable({ attempts, results, timeZone }: { attempts: AttemptRow[]; results: RawResultRow[]; timeZone: string }) {
  const { language, t } = useLocale();
  const resultByAttempt = new Map(results.map((result) => [result.attempt_id, result]));
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>{t("progress.level")}</th><th>{t("progress.status")}</th><th>{t("progress.started")}</th><th>{t("progress.rawResults")}</th><th><span className="sr-only">{t("progress.openResult")}</span></th></tr></thead>
        <tbody>{attempts.map((attempt) => {
          const result = resultByAttempt.get(attempt.id);
          const statusKey = attemptStatusKey(attempt.status);
          const rawCounts = result
            ? t("progress.rawCounts", {
                correct: formatCount(result.raw_correct, language),
                incorrect: formatCount(result.raw_incorrect, language),
                unanswered: formatCount(result.raw_unanswered, language),
              })
            : "—";
          return (
            <tr key={attempt.id}>
              <td>{attempt.level}</td>
              <td><span className="status-chip">{statusKey ? t(statusKey) : attempt.status.replaceAll("_", " ")}</span></td>
              <td>{formatDate(attempt.created_at, language, timeZone)}</td>
              <td>{rawCounts}</td>
              <td>{result ? <Link className="text-link" href={`/results/${attempt.id}`}>{t("progress.openResult")} <ArrowUpRight size={14} aria-hidden="true" /></Link> : ""}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
