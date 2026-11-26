"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { LocalizedText } from "@/components/i18n/localized-text";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createClientUuid } from "@/lib/client-uuid";
import type { JlptLevel } from "@/lib/jlpt-format";

export type PracticeTagOption = {
  level: JlptLevel;
  tag_slug: string;
  tag_label: string;
  question_count: number;
};

export type PracticeHistoryItem = {
  id: string;
  level: JlptLevel;
  tag_slug: string;
  status: "in_progress" | "submitted";
  question_count: number;
  raw_correct: number | null;
  created_at: string;
};

const levels: JlptLevel[] = ["N1", "N2", "N3", "N4", "N5"];

export function TargetedPracticeSetup({
  tags,
  history,
  initialLevel,
  initialTagSlug,
  timeZone,
}: {
  tags: PracticeTagOption[];
  history: PracticeHistoryItem[];
  initialLevel: JlptLevel;
  initialTagSlug?: string;
  timeZone: string;
}) {
  const router = useRouter();
  const { t, language } = useLocale();
  const [level, setLevel] = useState<JlptLevel>(initialLevel);
  const levelTags = tags.filter((tag) => tag.level === level);
  const [tagSlug, setTagSlug] = useState(levelTags.find((tag) => tag.tag_slug === initialTagSlug)?.tag_slug ?? levelTags[0]?.tag_slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const requestKey = useRef<string | null>(null);

  function changeLevel(nextLevel: JlptLevel) {
    requestKey.current = null;
    setLevel(nextLevel);
    setTagSlug(tags.find((tag) => tag.level === nextLevel)?.tag_slug ?? "");
  }

  async function start() {
    setBusy(true);
    setError(false);
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !tagSlug) {
      setError(true);
      setBusy(false);
      return;
    }
    try {
      requestKey.current ??= createClientUuid();
      const { data, error: startError } = await supabase.rpc("start_targeted_practice", {
        p_level: level,
        p_tag_slug: tagSlug,
        p_request_key: requestKey.current,
      });
      if (startError || !data) {
        setError(true);
        setBusy(false);
        return;
      }
      router.push(`/practice/${data}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="targeted-practice-setup">
      <div className="practice-demo-notice"><strong>{t("practice.preview")}</strong><p>{t("practice.demoNotice")}</p></div>
      <div className="targeted-practice-setup__fields">
        <label>{t("practice.level")}
          <select value={level} onChange={(event) => changeLevel(event.target.value as JlptLevel)}>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>{t("practice.skill")}
          <select value={tagSlug} onChange={(event) => { requestKey.current = null; setTagSlug(event.target.value); }} disabled={!levelTags.length}>
            {levelTags.map((tag) => <option key={tag.tag_slug} value={tag.tag_slug}>{tag.tag_label}</option>)}
          </select>
          {levelTags.length ? <span className="field-hint">{t("practice.questionCount", { count: levelTags.find((tag) => tag.tag_slug === tagSlug)?.question_count ?? 0 })}</span> : null}
        </label>
      </div>
      {error ? <p className="form-message form-message--error" role="alert">{t("practice.startError")}</p> : null}
      {levelTags.length ? (
        <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void start()}>
          <BookOpenCheck size={17} aria-hidden="true" /> {busy ? t("practice.starting") : t("practice.start")}
        </button>
      ) : <p className="inline-notice">{t("practice.noSkills")}</p>}

      <section className="practice-history">
        <h2>{t("practice.history")}</h2>
        {history.length ? <ul className="record-list">{history.map((item) => (
          <li key={item.id}>
            <span><strong>{item.level} · {item.tag_slug.replaceAll("-", " ")}</strong><small>{new Date(item.created_at).toLocaleString(language === "bn" ? "bn-BD" : "en", { dateStyle: "medium", timeStyle: "short", timeZone })}{item.raw_correct !== null ? ` · ${item.raw_correct}/${item.question_count}` : ""}</small></span>
            <Link className="text-link" href={item.status === "submitted" ? `/practice/${item.id}/review` : `/practice/${item.id}`}>
              {item.status === "submitted" ? t("practice.review") : t("practice.resume")} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}</ul> : <p className="data-footnote"><LocalizedText messageKey="practice.historyEmpty" /></p>}
      </section>
    </div>
  );
}
