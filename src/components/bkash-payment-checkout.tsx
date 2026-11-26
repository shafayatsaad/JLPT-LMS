"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { useLocale } from "@/components/i18n/locale-provider";
import { paymentRequestSchema } from "@/features/payments/payment-schema";
import { createClientUuid } from "@/lib/client-uuid";
import type { MessageKey } from "@/lib/i18n";

export type PaymentPlanOption = {
  id: string;
  code: string;
  name: string;
  name_bn: string;
  duration_days: number;
  price: number;
  currency: string;
  features: Record<string, unknown>;
};

export type PaymentCheckoutOptions = {
  enabled: boolean;
  provider?: string;
  payment_method?: string;
  recipient_display_name?: string;
  recipient_number?: string;
  recipient_account_type?: string;
  instructions_en?: string;
  instructions_bn?: string;
  reference_required?: boolean;
  support_contact?: string | null;
  plans: PaymentPlanOption[];
};

type SubmissionReceipt = {
  id: string;
  amount: number | string;
  currency: string;
  planName: string;
  planNameBn: string;
  durationDays: number;
  transactionMasked: string;
  receiptAttached: boolean;
};

const knownErrors = new Set([
  "payment.signInRequired", "payment.checkoutClosed", "payment.pendingExists", "payment.duplicateTransaction",
  "payment.planUnavailable", "payment.confirmAccuracy", "payment.referenceRequired", "payment.senderInvalid",
  "payment.transactionInvalid", "payment.dateFuture", "payment.validationError", "payment.submitError", "payment.unavailable",
  "payment.receiptTooLarge", "payment.receiptTypeInvalid", "payment.receiptFileInvalid", "payment.receiptUploadFailed", "payment.receiptUnavailable",
]);

function currentTimeInTimeZone(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  }
}

function localDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const safeTime = time || (date === todayInTimeZone(timeZone) ? currentTimeInTimeZone(timeZone) : "12:00");
  const [hour, minute] = safeTime.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(wallClockAsUtc));
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    const zonedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
    return new Date(wallClockAsUtc - (zonedAsUtc - wallClockAsUtc)).toISOString();
  } catch {
    return new Date(`${date}T${safeTime}:00`).toISOString();
  }
}

function formatAmount(amount: number | string, currency: string, language: "en" | "bn") {
  const locale = language === "bn" ? "bn-BD" : "en";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${currency} ${new Intl.NumberFormat(locale).format(Number(amount))}`;
  }
}

function todayInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function BkashPaymentCheckout({ options, setupError, timeZone, demoMode = false, nextPath = "/exams" }: { options: PaymentCheckoutOptions | null; setupError: boolean; timeZone: string; demoMode?: boolean; nextPath?: string }) {
  const { language, t } = useLocale();
  const numberLocale = language === "bn" ? "bn-BD" : "en";
  const maximumPaymentDate = todayInTimeZone(timeZone);
  const [planId, setPlanId] = useState(options?.plans[0]?.id ?? "");
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileError, setReceiptFileError] = useState<MessageKey | null>(null);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const selectedPlan = options?.plans.find((plan) => plan.id === planId) ?? options?.plans[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options?.enabled || !selectedPlan) return;
    setErrorKey(null);
    if (receiptFileError) { setErrorKey(receiptFileError); return; }
    let paymentAt: string;
    try {
      paymentAt = localDateTimeToIso(paymentDate, paymentTime, timeZone);
    } catch {
      setErrorKey("payment.validationError");
      return;
    }
    const payload = {
      planId: selectedPlan.id,
      senderName,
      senderNumber,
      transactionId,
      referenceNumber: referenceNumber.trim() || null,
      paymentAt,
      note: note.trim() || null,
      termsConfirmed,
      idempotencyKey: idempotencyKey.current ?? createClientUuid(),
    };
    const parsed = paymentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorKey("payment.validationError");
      return;
    }

    idempotencyKey.current = parsed.data.idempotencyKey;
    setBusy(true);
    try {
      const response = await fetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        cache: "no-store",
      });
      const result = await response.json() as { id?: string; error?: string; amount?: number | string; currency?: string; planName?: string; planNameBn?: string; durationDays?: number; transactionMasked?: string };
      if (!response.ok || !result.id) {
        const resultKey = result.error && knownErrors.has(result.error) ? result.error as MessageKey : "payment.submitError";
        setErrorKey(resultKey);
        return;
      }
      let receiptAttached = false;
      if (receiptFile) {
        const uploadBody = new FormData();
        uploadBody.set("receipt", receiptFile);
        const uploadResponse = await fetch(`/api/payment-requests/${result.id}/receipt`, {
          method: "POST",
          body: uploadBody,
          cache: "no-store",
        });
        const uploadResult = await uploadResponse.json().catch(() => ({})) as { error?: string };
        if (!uploadResponse.ok) {
          const uploadError = uploadResult.error && knownErrors.has(uploadResult.error) ? uploadResult.error as MessageKey : "payment.receiptUploadFailed";
          setErrorKey(uploadError);
          return;
        }
        receiptAttached = true;
      }
      setReceipt({
        id: result.id,
        amount: result.amount ?? selectedPlan.price,
        currency: result.currency ?? selectedPlan.currency,
        planName: result.planName ?? selectedPlan.name,
        planNameBn: result.planNameBn ?? selectedPlan.name_bn,
        durationDays: result.durationDays ?? selectedPlan.duration_days,
        transactionMasked: result.transactionMasked ?? `${transactionId.slice(0, 3)}••••${transactionId.slice(-4)}`,
        receiptAttached,
      });
      setReceiptFile(null);
      idempotencyKey.current = null;
    } catch {
      setErrorKey("payment.submitError");
    } finally {
      setBusy(false);
    }
  }

  if (setupError) return <p className="inline-notice"><LocalizedText messageKey="paymentCheckout.setupError" /></p>;
  if (!options?.enabled || !options.plans.length) {
    return (
      <div className="empty-state">
        <h2><LocalizedText messageKey="paymentCheckout.closedTitle" /></h2>
        <p><LocalizedText messageKey="paymentCheckout.closedDescription" /></p>
        <Link className="text-link" href="/pricing"><LocalizedText messageKey="paymentCheckout.backToPlans" /> <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    );
  }

  if (receipt) {
    return (
      <div className="payment-confirmation">
        <p className="status-chip">{t("payments.status.pending")}</p>
        <h2>{t("payment.confirmationTitle")}</h2>
        <p>{t("payment.requestNumber", { id: receipt.id })}</p>
        <p>{language === "bn" ? receipt.planNameBn : receipt.planName} · {t("pricing.days", { count: new Intl.NumberFormat(numberLocale).format(receipt.durationDays) })} · {formatAmount(receipt.amount, receipt.currency, language)}</p>
        <p>{t("payment.maskedTransaction", { id: receipt.transactionMasked })}</p>
        <p>{t("payment.pendingMessage")}</p>
        {receipt.receiptAttached ? <p className="inline-notice">{t("payment.receiptAttached")}</p> : null}
        <p className="field-hint">The payment is pending admin review. After approval, you can return to your requested exam.</p>
        <Link className="btn btn--secondary" href={nextPath}>Return to requested page <ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link className="btn btn--primary" href="/payments">{t("payment.viewHistory")} <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    );
  }

  const instructions = language === "bn" ? options.instructions_bn : options.instructions_en;
  const displayPlanName = (plan: PaymentPlanOption) => language === "bn" ? plan.name_bn : plan.name;

  function fillDemoDetails() {
    setSenderName("Demo Student");
    setSenderNumber("00000000000");
    setTransactionId(`DEMO-${Date.now()}`);
    setReferenceNumber("LOCAL-DEMO");
    setPaymentDate(maximumPaymentDate);
    setNote(t("payment.demoNote"));
    setTermsConfirmed(true);
  }

  return (
    <div className="payment-checkout">
      {demoMode ? <aside className="local-payment-notice" role="note"><strong><LocalizedText messageKey="demo.bannerLabel" /></strong><p><LocalizedText messageKey="payment.demoWarning" /></p><div className="local-payment-notice__actions"><button className="btn btn--secondary" type="button" onClick={fillDemoDetails}><LocalizedText messageKey="payment.demoFillDetails" /></button></div></aside> : null}
      <div className="payment-checkout__instructions">
        <p><strong>{t("payment.recipient")}:</strong> {options.recipient_display_name} · {options.recipient_number}</p>
        <p><strong>{t("payment.accountType")}:</strong> {options.recipient_account_type}</p>
        <h2>{t("payment.instructions")}</h2>
        <p lang={language} className="payment-checkout__copy">{instructions}</p>
        {options.support_contact ? <p><strong>{t("support.contactTitle")}:</strong> {options.support_contact}</p> : null}
      </div>

      <form className="payment-checkout-form auth-form" onSubmit={(event) => void submit(event)}>
        <label>{t("payment.plan")}
          <select required value={selectedPlan?.id ?? ""} onChange={(event) => setPlanId(event.target.value)}>
            {options.plans.map((plan) => <option key={plan.id} value={plan.id}>{displayPlanName(plan)} · {t("pricing.days", { count: new Intl.NumberFormat(numberLocale).format(plan.duration_days) })}</option>)}
          </select>
        </label>
        {selectedPlan ? <p className="payment-checkout__amount"><strong>{t("payment.expectedAmount")}:</strong> {formatAmount(selectedPlan.price, selectedPlan.currency, language)}</p> : null}
        <div className="payment-checkout-form__grid">
          <label>{t("payment.senderName")}<input autoComplete="name" maxLength={120} minLength={2} required value={senderName} onChange={(event) => setSenderName(event.target.value)} /></label>
          <label>{t("payment.senderNumber")}<input autoComplete="tel" maxLength={32} minLength={6} inputMode="tel" required value={senderNumber} onChange={(event) => setSenderNumber(event.target.value)} /></label>
          <label>{t("payment.transactionId")}<input autoCapitalize="characters" maxLength={80} minLength={4} required value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></label>
          <label>{t("payment.referenceNumber")} {!options.reference_required ? <span className="field-optional">{t("payment.optional")}</span> : null}<input maxLength={120} required={options.reference_required} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></label>
          <label>{t("payment.paymentDate")}<input type="date" required max={maximumPaymentDate} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
          <label>{t("payment.paymentTime")} <span className="field-optional">{t("payment.optional")}</span><input type="time" value={paymentTime} onChange={(event) => setPaymentTime(event.target.value)} /></label>
        </div>
        <label>{t("payment.note")} <span className="field-optional">{t("payment.optional")}</span><textarea maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label>{t("payment.receiptUpload")} <span className="field-optional">{t("payment.optional")}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setErrorKey(null);
          setReceiptFileError(null);
          if (file && file.size > 4 * 1024 * 1024) { setReceiptFile(null); setReceiptFileError("payment.receiptTooLarge"); setErrorKey("payment.receiptTooLarge"); return; }
          if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setReceiptFile(null); setReceiptFileError("payment.receiptTypeInvalid"); setErrorKey("payment.receiptTypeInvalid"); return; }
          setReceiptFile(file);
        }} /></label>
        <p className="field-hint">{t("payment.receiptHint")}</p>
        <p className="field-hint">{t("support.credentialHint")}</p>
        <label className="profile-checkbox"><input type="checkbox" required checked={termsConfirmed} onChange={(event) => setTermsConfirmed(event.target.checked)} /><span>{t("payment.accuracyConfirmation")}</span></label>
        {errorKey ? <p className="form-message form-message--error" role="alert">{t(errorKey)}</p> : null}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? t("payment.submitting") : t("payment.submitRequest")}</button>
      </form>
    </div>
  );
}
