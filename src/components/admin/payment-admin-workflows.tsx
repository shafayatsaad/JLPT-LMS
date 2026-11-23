"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminPaymentQueueRow = {
  id: string;
  user_id: string;
  learner_name: string | null;
  learner_email: string | null;
  plan_code: string;
  plan_name: string;
  plan_name_bn: string;
  plan_duration_days: number;
  expected_amount: number;
  amount: number;
  currency: string;
  status: string;
  sender_number_masked: string | null;
  transaction_reference: string | null;
  submitted_at: string;
  age_hours: number;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
  reviewed_at: string | null;
};

export type AdminPaymentPlan = {
  id: string;
  code: string;
  name: string;
  name_bn: string;
  price: number;
  currency: string;
  duration_days: number;
  features: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
};

type ManualPaymentSettings = {
  is_enabled: boolean;
  recipient_display_name: string | null;
  recipient_number: string | null;
  recipient_account_type: string | null;
  instructions_en: string | null;
  instructions_bn: string | null;
  reference_required: boolean;
  support_contact: string | null;
};

type PaymentDetail = {
  id: string;
  user_id: string;
  learner_name: string | null;
  learner_email: string | null;
  account_created_at: string | null;
  account_banned_until: string | null;
  plan: Record<string, unknown>;
  expected_amount: number;
  submitted_amount: number;
  currency: string;
  provider: string;
  payment_method: string;
  sender_name: string | null;
  sender_number: string | null;
  sender_number_revealed: boolean;
  transaction_reference: string | null;
  reference_number: string | null;
  payment_at: string | null;
  request_note: string | null;
  status: string;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
  cancellation_resolution_note: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  rejection_category: string | null;
  student_message_en: string | null;
  student_message_bn: string | null;
  active_entitlement: Record<string, unknown> | null;
  previous_request_count: number;
  audit_history: { action: string; actor_user_id: string; created_at: string; after_state: Record<string, unknown> | null }[];
};

function amount(value: number | string, currency: string) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value)); }
  catch { return `${currency} ${value}`; }
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

function InlineMessage({ error, message }: { error: string; message: string }) {
  return <>{error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}{message ? <p className="form-message form-message--success" role="status">{message}</p> : null}</>;
}

function PaymentPlanEditor({ plan }: { plan: AdminPaymentPlan }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [nameBn, setNameBn] = useState(plan.name_bn);
  const [price, setPrice] = useState(String(plan.price));
  const [duration, setDuration] = useState(String(plan.duration_days));
  const [features, setFeatures] = useState(JSON.stringify(plan.features, null, 2));
  const [active, setActive] = useState(plan.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsedFeatures: unknown;
    try { parsedFeatures = JSON.parse(features); }
    catch { setError("Features must be valid JSON."); return; }
    if (!parsedFeatures || typeof parsedFeatures !== "object" || Array.isArray(parsedFeatures)) {
      setError("Features must be a JSON object.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured for this session."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.rpc("save_admin_payment_plan", {
      p_code: plan.code,
      p_name: name,
      p_name_bn: nameBn,
      p_price: Number(price),
      p_duration_days: Number(duration),
      p_features: parsedFeatures,
      p_is_active: active,
    });
    setBusy(false);
    if (saveError) { setError("Plan settings could not be saved. Check the values and confirm migration 022 is applied."); return; }
    setMessage("Plan saved. Existing requests keep their original snapshots.");
    router.refresh();
  }

  return (
    <article className="payment-plan-editor">
      <div className="payment-plan-editor__heading"><div><span className="status-chip status-chip--muted">{plan.code}</span><h3>{plan.name}</h3></div><span className={`status-chip${active ? "" : " status-chip--muted"}`}>{active ? "Active for checkout" : "Inactive"}</span></div>
      <form className="workflow-form" onSubmit={(event) => void save(event)}>
        <div className="payment-admin-grid">
          <label>Plan name · English<input required minLength={3} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Plan name · বাংলা<input required minLength={3} maxLength={80} lang="bn" value={nameBn} onChange={(event) => setNameBn(event.target.value)} /></label>
          <label>Price · BDT<input required type="number" min="0" max="10000000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label>Duration · days<input required type="number" min="1" max="3650" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
        </div>
        <label>Feature entitlement snapshot (JSON object)<textarea required rows={5} spellCheck={false} value={features} onChange={(event) => setFeatures(event.target.value)} /></label>
        <label className="admin-export-form__sensitive"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Available for new payment requests</label>
        <InlineMessage error={error} message={message} />
        <button className="btn btn--secondary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save plan"}</button>
      </form>
    </article>
  );
}

export function PaymentPlanManager({ plans }: { plans: AdminPaymentPlan[] }) {
  return (
    <div className="payment-admin-workflow">
      <p className="workflow-note"><strong>Admin only.</strong> Proposed plans are seeded inactive at zero price. Activating a plan makes it purchasable only if the separate bKash settings are also enabled. Changes are audited; existing payment requests keep an immutable snapshot.</p>
      {plans.length ? plans.map((plan) => <PaymentPlanEditor key={plan.id} plan={plan} />) : <div className="empty-state"><p>No plan records are configured. Apply migration 022 to create the inactive 30/90/365-day defaults.</p></div>}
    </div>
  );
}

export function ManualPaymentSettingsForm({ settings }: { settings: ManualPaymentSettings }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.is_enabled);
  const [recipientName, setRecipientName] = useState(settings.recipient_display_name ?? "");
  const [recipientNumber, setRecipientNumber] = useState(settings.recipient_number ?? "");
  const [accountType, setAccountType] = useState(settings.recipient_account_type ?? "");
  const [instructionsEn, setInstructionsEn] = useState(settings.instructions_en ?? "");
  const [instructionsBn, setInstructionsBn] = useState(settings.instructions_bn ?? "");
  const [referenceRequired, setReferenceRequired] = useState(settings.reference_required);
  const [supportContact, setSupportContact] = useState(settings.support_contact ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured for this session."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: saveError } = await supabase.rpc("save_admin_payment_settings", {
      p_is_enabled: enabled,
      p_recipient_display_name: recipientName,
      p_recipient_number: recipientNumber,
      p_recipient_account_type: accountType,
      p_instructions_en: instructionsEn,
      p_instructions_bn: instructionsBn,
      p_reference_required: referenceRequired,
      p_support_contact: supportContact || null,
    });
    setBusy(false);
    if (saveError) { setError("Payment settings could not be saved. Confirm values and migration 022. Checkout remains controlled by the database."); return; }
    setMessage(enabled ? "Settings saved. Checkout will open only when at least one active, priced plan exists." : "Payment checkout is disabled.");
    router.refresh();
  }

  return (
    <div className="payment-admin-workflow">
      <p className="workflow-note"><strong>Admin only.</strong> Recipient information and instructions are shown to signed-in learners only while checkout is enabled. Enter only details verified by the account owner. Both English and Bangla instructions are required before activation.</p>
      <form className="workflow-form" onSubmit={(event) => void save(event)}>
        <div className="payment-admin-grid">
          <label>Recipient display name<input minLength={2} maxLength={120} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></label>
          <label>Recipient bKash number<input minLength={6} maxLength={32} inputMode="tel" value={recipientNumber} onChange={(event) => setRecipientNumber(event.target.value)} /></label>
          <label>Recipient account type<input minLength={2} maxLength={80} value={accountType} onChange={(event) => setAccountType(event.target.value)} placeholder="Use the account owner’s verified wording" /></label>
          <label>Support contact · optional<input maxLength={200} value={supportContact} onChange={(event) => setSupportContact(event.target.value)} /></label>
        </div>
        <div className="announcement-form__languages">
          <fieldset><legend>Send Money instructions · English</legend><textarea rows={6} minLength={20} maxLength={2000} value={instructionsEn} onChange={(event) => setInstructionsEn(event.target.value)} /></fieldset>
          <fieldset><legend lang="bn">Send Money নির্দেশনা · বাংলা</legend><textarea rows={6} minLength={20} maxLength={2000} lang="bn" value={instructionsBn} onChange={(event) => setInstructionsBn(event.target.value)} /></fieldset>
        </div>
        <label className="admin-export-form__sensitive"><input type="checkbox" checked={referenceRequired} onChange={(event) => setReferenceRequired(event.target.checked)} /> Require a payment reference</label>
        <label className="admin-export-form__sensitive"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable bKash Send Money checkout</label>
        <InlineMessage error={error} message={message} />
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save payment settings"}</button>
      </form>
    </div>
  );
}

export function PaymentReviewQueue({
  initialRows,
  initialPaymentId,
  detailOnly = false,
}: {
  initialRows: AdminPaymentQueueRow[];
  initialPaymentId?: string;
  detailOnly?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [category, setCategory] = useState("other");
  const [messageEn, setMessageEn] = useState("");
  const [messageBn, setMessageBn] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptState, setReceiptState] = useState<"loading" | "none" | "available" | "unavailable">("none");

  async function loadQueue(status = filterStatus, query = search) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured for this session."); return; }
    setBusy("queue"); setError("");
    const { data, error: loadError } = await supabase.rpc("get_admin_payment_review_queue", {
      p_status: status || null,
      p_from_date: null,
      p_to_date: null,
      p_search: query.trim() || null,
    });
    setBusy("");
    if (loadError) { setError("The payment queue could not be refreshed. Confirm migration 022 and the reviewer role."); return; }
    setRows((data ?? []) as AdminPaymentQueueRow[]);
  }

  const loadDetail = useCallback(async (id: string, reveal = false) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured for this session."); return; }
    setBusy(`detail:${id}`); setError("");
    const { data, error: loadError } = await supabase.rpc("get_admin_payment_detail", {
      p_payment_submission_id: id,
      p_reveal_sender: reveal,
    });
    setBusy("");
    if (loadError || !data || typeof data !== "object") { setError("Payment detail could not be loaded. Confirm the reviewer role and database migration."); return; }
    setDetail(data as PaymentDetail);
    setReceiptUrl("");
    setReceiptState("loading");
    const { data: receiptPath, error: receiptPathError } = await supabase.rpc("get_admin_payment_receipt_path", { p_payment_submission_id: id });
    if (receiptPathError) {
      setReceiptState("unavailable");
    } else if (typeof receiptPath === "string") {
      const { data: signedReceipt, error: signedReceiptError } = await supabase.storage.from("jlpt-payment-receipts").createSignedUrl(receiptPath, 300);
      if (signedReceiptError || !signedReceipt?.signedUrl) setReceiptState("unavailable");
      else { setReceiptUrl(signedReceipt.signedUrl); setReceiptState("available"); }
    } else {
      setReceiptState("none");
    }
  }, []);

  useEffect(() => {
    if (!initialPaymentId) return;
    const timer = window.setTimeout(() => void loadDetail(initialPaymentId), 0);
    return () => window.clearTimeout(timer);
  }, [initialPaymentId, loadDetail]);

  async function review(action: "under_review" | "return_to_pending" | "approve" | "reject" | "cancel") {
    if (!detail) return;
    if (internalNote.trim().length < 5) { setError("Add an internal note of at least five characters for the audit record."); return; }
    if (action === "reject" && (messageEn.trim().length < 5 || messageBn.trim().length < 5)) { setError("Provide a safe learner message in both English and Bangla."); return; }
    if (action === "approve" && !window.confirm(`Verify ${amount(detail.submitted_amount, detail.currency)} for ${detail.learner_email ?? detail.user_id}? This creates the premium entitlement${detail.cancellation_requested_at ? " and resolves the learner’s cancellation request because funds were received" : ""}.`)) return;
    if (action === "cancel" && !window.confirm("Confirm that no funds were received and close this payment request?")) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase is not configured for this session."); return; }
    setBusy(`review:${action}`); setError(""); setMessage("");
    const { error: reviewError } = await supabase.rpc("review_payment_request", {
      p_payment_submission_id: detail.id,
      p_action: action,
      p_internal_note: internalNote.trim(),
      p_rejection_category: action === "reject" ? category : null,
      p_student_message_en: action === "reject" ? messageEn.trim() : null,
      p_student_message_bn: action === "reject" ? messageBn.trim() : null,
    });
    setBusy("");
    if (reviewError) { setError("The review action was not completed. Confirm the request state and reviewer permissions."); return; }
    setMessage(`Payment request updated: ${action.replaceAll("_", " ")}.`);
    await loadQueue();
    await loadDetail(detail.id);
    router.refresh();
  }

  const detailAllowed = detail && !detail.cancelled_at && detail.status !== "verified" && detail.status !== "rejected";
  return (
    <div className="payment-admin-workflow">
      {detailOnly ? <p><Link className="text-link" href="/admin/payments">← Back to payment queue</Link></p> : null}
      <div className="workflow-note"><strong>Manual verification.</strong> Check the transaction in the trusted bKash account record. A submitted form or screenshot is not payment proof. A second approval cannot grant extra days.</div>
      <InlineMessage error={error} message={message} />
      {!detailOnly ? <form className="payment-queue-filters" onSubmit={(event) => { event.preventDefault(); void loadQueue(); }}>
        <label>Status<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="needs_review">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label>
        <label>Request, email, transaction ID or plan<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button className="btn btn--secondary" type="submit" disabled={busy === "queue"}>{busy === "queue" ? "Loading…" : "Filter queue"}</button>
      </form> : null}
      {!detailOnly && !rows.length ? <div className="empty-state"><p>No payment requests match this view.</p></div> : null}
      {!detailOnly && rows.length ? <div className="table-scroll"><table><thead><tr><th>Request / learner</th><th>Plan</th><th>Expected / paid</th><th>Sender · masked</th><th>Transaction</th><th>Submitted · age</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
        <td><code>{row.id.slice(0, 8)}</code><br />{row.learner_name || row.learner_email || row.user_id}<small>{row.learner_email}</small></td>
        <td>{row.plan_name}<small>{row.plan_duration_days} days · {row.plan_code}</small></td>
        <td>{amount(row.expected_amount, row.currency)}<small>Paid: {amount(row.amount, row.currency)}</small></td>
        <td>{row.sender_number_masked || "—"}<small>{row.cancellation_requested_at ? "Cancellation requested" : ""}</small></td>
        <td><code>{row.transaction_reference || "—"}</code></td>
        <td>{dateTime(row.submitted_at)}<small>{row.age_hours} hours</small></td>
        <td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td>
        <td><Link className="text-button" href={`/admin/payments/${row.id}`}>Review request</Link></td>
      </tr>)}</tbody></table></div> : null}

      {detailOnly && !detail && !error ? <p className="section-note" role="status">Loading payment request…</p> : null}
      {detail ? <section className="payment-detail" aria-labelledby="payment-detail-heading">
        <div className="payment-detail__heading"><div><span className="product-small-label">Request {detail.id.slice(0, 8)}</span><h2 id="payment-detail-heading">{detail.learner_name || detail.learner_email || detail.user_id}</h2><p>{detail.learner_email} · Account {detail.user_id}</p></div><button className="auth-quiet-action" type="button" onClick={() => detailOnly ? router.push("/admin/payments") : setDetail(null)}>{detailOnly ? "Back to queue" : "Close"}</button></div>
        <div className="payment-detail__grid">
          <div><strong>Plan snapshot</strong><p>{String(detail.plan.name ?? "Plan")} · {String(detail.plan.duration_days ?? "?")} days</p><p>Expected {amount(detail.expected_amount, detail.currency)} · paid {amount(detail.submitted_amount, detail.currency)}</p></div>
          <div><strong>Sender</strong><p>{detail.sender_name || "—"}</p><p>{detail.sender_number || "Not supplied"}</p>{!detail.sender_number_revealed ? <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => void loadDetail(detail.id, true)}>Reveal sender number · audit access</button> : <small>Number reveal logged to the admin audit.</small>}</div>
          <div><strong>Transaction</strong><p>{detail.provider} · {detail.payment_method}</p><p>TrxID: <code>{detail.transaction_reference || "—"}</code></p><p>Reference: {detail.reference_number || "—"}</p><p>Payment date: {dateTime(detail.payment_at)}</p></div>
          <div><strong>Request and current access</strong><p>Submitted {dateTime(rows.find((row) => row.id === detail.id)?.submitted_at)}</p><p>Previous requests: {detail.previous_request_count}</p><p>{detail.active_entitlement ? `Active until ${dateTime(String(detail.active_entitlement.ends_at))}` : "No active entitlement"}</p><p>{detail.cancellation_requested_at ? `Cancellation requested ${dateTime(detail.cancellation_requested_at)}` : "No open cancellation request"}</p>{detail.cancellation_resolution_note && !detail.cancelled_at ? <p>Cancellation request resolution: {detail.cancellation_resolution_note}</p> : null}</div>
        </div>
        <div className="payment-detail__receipt"><strong>Optional receipt</strong>{receiptState === "loading" ? <p>Checking for a private receipt…</p> : null}{receiptState === "none" ? <p>No receipt was attached.</p> : null}{receiptState === "unavailable" ? <p>The receipt is not available, or the private receipt migration has not been applied.</p> : null}{receiptState === "available" ? <p><a className="text-button" href={receiptUrl} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">Open private receipt · link expires in 5 minutes</a></p> : null}<small>A receipt is supporting context only; verify the transfer independently in the trusted bKash account record.</small></div>
        {detail.request_note ? <p><strong>Learner note:</strong> {detail.request_note}</p> : null}
        {detail.cancelled_at ? <p className="inline-notice">Cancelled {dateTime(detail.cancelled_at)} · {detail.cancellation_resolution_note}</p> : null}
        <details className="payment-audit-history"><summary>Payment audit history</summary><ol>{detail.audit_history.map((event, index) => <li key={`${event.created_at}-${index}`}><strong>{event.action}</strong><time>{dateTime(event.created_at)}</time><code>{JSON.stringify(event.after_state ?? {})}</code></li>)}</ol></details>
        {detailAllowed ? <form className="workflow-form payment-review-form" onSubmit={(event) => event.preventDefault()}>
          <label>Internal verification note<textarea required minLength={5} maxLength={1000} rows={3} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Record how the transaction was checked. Do not include PINs or OTPs." /></label>
          {detail.status !== "verified" && detail.status !== "rejected" ? <>
            <label>Rejection category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="amount_mismatch">Amount mismatch</option><option value="transaction_not_found">Transaction not found</option><option value="duplicate_transaction">Duplicate transaction</option><option value="recipient_mismatch">Recipient mismatch</option><option value="invalid_details">Invalid details</option><option value="other">Other</option></select></label>
            <div className="announcement-form__languages">
              <fieldset><legend>Safe learner message · English (reject only)</legend><textarea maxLength={500} rows={3} value={messageEn} onChange={(event) => setMessageEn(event.target.value)} /></fieldset>
              <fieldset><legend lang="bn">নিরাপদ শিক্ষার্থী বার্তা · বাংলা (প্রত্যাখ্যানের জন্য)</legend><textarea maxLength={500} rows={3} lang="bn" value={messageBn} onChange={(event) => setMessageBn(event.target.value)} /></fieldset>
            </div>
            <div className="payment-review-actions">
              {detail.status === "pending" ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void review("under_review")}>Mark under review</button> : null}
              {detail.status === "needs_review" && !detail.cancellation_requested_at ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void review("return_to_pending")}>Return to pending</button> : null}
              <button className="btn btn--primary" type="button" disabled={Boolean(busy)} onClick={() => void review("approve")}>Approve payment</button>
              <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void review("reject")}>Reject payment</button>
              {detail.cancellation_requested_at ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void review("cancel")}>Confirm no funds · cancel</button> : null}
            </div>
          </> : null}
        </form> : <p className="section-note">This request is terminal and cannot be approved or changed.</p>}
      </section> : null}
    </div>
  );
}
