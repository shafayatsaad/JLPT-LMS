import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { QuestionBankTable, type QuestionBankTableRow } from "@/components/admin/question-bank-table";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank · Administration" };

const statuses = ["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"] as const;
const levels = ["N1", "N2", "N3", "N4", "N5"] as const;
const sortModes = ["created_desc", "created_asc", "updated_desc", "updated_asc", "level_asc", "status_asc"] as const;
const pageSize = 50;

function queryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.type === "text") return String(record.text ?? record.value ?? "");
  if (record.type === "ruby") return [record.base, record.reading].map(textContent).filter(Boolean).join(" ");
  if (record.type === "line_break") return " ";
  if ("content" in record) return textContent(record.content);
  if ("text" in record) return textContent(record.text);
  return Object.values(record).map(textContent).filter(Boolean).join(" ");
}

function boundedPage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? Math.max(1, Math.min(parsed, 100_000)) : 1;
}

function makePageHref(page: number, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, page: String(page) });
  return `/admin/questions?${query.toString()}`;
}

export default async function AdminQuestionBankPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawStatus = queryValue(params.status);
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const rawLevel = queryValue(params.level);
  const level = levels.includes(rawLevel as typeof levels[number]) ? rawLevel : "";
  const section = queryValue(params.section).slice(0, 80);
  const itemType = queryValue(params.type).slice(0, 80);
  const skill = queryValue(params.skill).toLowerCase().slice(0, 80);
  const search = queryValue(params.q).slice(0, 120);
  const rawDifficulty = queryValue(params.difficulty);
  const difficulty = /^[1-5]$/.test(rawDifficulty) ? Number(rawDifficulty) : null;
  const rawSort = queryValue(params.sort);
  const sort = sortModes.includes(rawSort as typeof sortModes[number]) ? rawSort : "created_desc";
  const page = boundedPage(queryValue(params.page));
  const { supabase, user, role } = await requireStaff(["content_editor", "reviewer", "admin"], "/admin/questions");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Question bank unavailable" description="Connect the configured database and sign in with a content editor, reviewer or administrator account."><ProductSection title="Setup required"><PaperPanel><p>Question inventory requires the platform schema and staff role assignment.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const canSubmitForReview = role === "content_editor" || role === "admin";
  const [countResults, searchResult] = await Promise.all([
    Promise.all(statuses.map((item) => supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", item))),
    supabase.rpc("search_question_bank", {
      p_search: search || null,
      p_level: level || null,
      p_section: section || null,
      p_item_type: itemType || null,
      p_skill: skill || null,
      p_status: status || null,
      p_difficulty: difficulty,
      p_sort: sort,
      p_page: page,
      p_page_size: pageSize,
    }),
  ]);
  const counts = Object.fromEntries(statuses.map((item, index) => [item, countResults[index].count ?? null]));
  const payload = Array.isArray(searchResult.data) ? searchResult.data[0] : null;
  const rows = ((payload?.items ?? []) as Array<QuestionBankTableRow & { prompt?: unknown }>).map((row) => ({
    ...row,
    prompt_preview: typeof row.prompt_preview === "string" ? row.prompt_preview : textContent(row.prompt),
  }));
  const totalCount = Number(payload?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const countError = countResults.some((result) => result.error);
  const filters = { q: search, level, section, skill, type: itemType, status, difficulty: difficulty ? String(difficulty) : "", sort };

  return (
    <ProductPage eyebrow="Staff workspace · editor/reviewer" title="Question bank" description="Search every question revision, then filter, sort, open or safely submit your drafts for independent review." className="product-page--admin" navigation={<AdminNavigation activePath="/admin/questions" />}>
      <ProductSection title="Question inventory" className="product-section--tint">
        <PaperPanel className="data-panel">
          <div className="question-bank-actions"><div><p>Keep each question revision traceable from draft through independent review. Each result page loads directly from the database.</p></div><div className="account-strip__actions"><Link className="btn btn--primary" href="/admin/questions/new#manual-question">Add question</Link><Link className="btn btn--secondary" href="/admin/questions/new#import-questions">Upload content</Link></div></div>
          <div className="question-bank-counts" aria-label="Question counts by status">{statuses.map((item) => <div key={item}><span>{item === "retired" ? "archived" : item.replaceAll("_", " ")}</span><strong>{counts[item] === null ? "—" : counts[item]}</strong></div>)}</div>
          {countError ? <p className="section-note">One or more status counts could not be loaded for this role.</p> : null}
          <form className="admin-export-form question-bank-filters" method="get">
            <div className="admin-export-form__fields">
              <label>Search by ID or question text<input name="q" defaultValue={search} maxLength={120} placeholder="Question ID, family or Japanese text" /></label>
              <label>JLPT level<select name="level" defaultValue={level}><option value="">All levels</option>{levels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
              <label>Section code<input name="section" defaultValue={section} maxLength={80} placeholder="e.g. vocabulary" /></label>
              <label>Skill tag<input name="skill" defaultValue={skill} maxLength={80} placeholder="e.g. vocabulary" /></label>
              <label>Question type<input name="type" defaultValue={itemType} maxLength={80} placeholder="Type code" /></label>
              <label>Difficulty<select name="difficulty" defaultValue={difficulty ?? ""}><option value="">Any difficulty</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
              <label>Status<select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{item === "retired" ? "archived" : item.replaceAll("_", " ")}</option>)}</select></label>
              <label>Sort by<select name="sort" defaultValue={sort}><option value="created_desc">Recently created</option><option value="created_asc">Oldest created</option><option value="updated_desc">Recently updated</option><option value="updated_asc">Oldest updated</option><option value="level_asc">JLPT level</option><option value="status_asc">Status</option></select></label>
              <input type="hidden" name="page" value="1" />
            </div>
            <div className="question-bank-filters__actions"><button className="btn btn--secondary" type="submit">Apply filters</button><Link className="text-link" href="/admin/questions">Clear filters</Link></div>
          </form>
          {searchResult.error ? <p className="inline-notice">The question bank search is unavailable. Apply the latest local migration and confirm your content editor or reviewer role. Details: {searchResult.error.message}</p> : <>
            <p className="section-note" aria-live="polite">Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} matching revisions.</p>
            <QuestionBankTable rows={rows} userId={user.id} canSubmitForReview={canSubmitForReview} />
            {pageCount > 1 ? <nav className="question-bank-pagination" aria-label="Question result pages"><span>Page {page} of {pageCount}</span><div>{page > 1 ? <Link className="btn btn--secondary" href={makePageHref(page - 1, filters)}>Previous</Link> : <span className="btn btn--secondary" aria-disabled="true">Previous</span>}{page < pageCount ? <Link className="btn btn--secondary" href={makePageHref(page + 1, filters)}>Next</Link> : <span className="btn btn--secondary" aria-disabled="true">Next</span>}</div></nav> : null}
          </>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
