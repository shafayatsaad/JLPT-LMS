"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PaymentRow = {
  id: string;
  provider: string;
  payment_method: string;
  amount: number | string;
  currency: string;
  status: string;
  submitted_at: string;
  plan_snapshot?: { name?: string; name_bn?: string } | null;
  transaction_reference?: string | null;
  cancellation_requested_at?: string | null;
  cancelled_at?: string | null;
  receipt_uploaded_at?: string | null;
};

type EntitlementRow = {
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
};

function localizeDate(value: string, language: "en" | "bn", timeZone: string) {
  const locale = language === "bn" ? "bn-BD" : "en";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
}

function localizeAmount(amount: number | string, currency: string, language: "en" | "bn") {
  const locale = language === "bn" ? "bn-BD" : "en";
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat(locale).format(value)}`;
  }
}

function paymentStatusKey(status: string): MessageKey | null {
  if (status === "pending" || status === "verified" || status === "rejected" || status === "needs_review") {
    return `payments.status.${status}`;
  }
  return null;
}

function entitlementStatusKey(status: string): MessageKey | null {
  if (status === "active" || status === "expired" || status === "cancelled" || status === "revoked") {
    return `subscription.status.${status}`;
  }
  return null;
}

export function PaymentHistoryTable({ payments, timeZone }: { payments: PaymentRow[]; timeZone: string }) {
  const router = useRouter();
  const { language, t } = useLocale();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState(false);

  async function requestCancellation(paymentId: string) {
    if (!window.confirm(t("payment.cancelConfirm"))) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(true);
      return;
    }
    setBusyId(paymentId);
    setError(false);
    const { error: cancelError } = await supabase.rpc("request_payment_cancellation", { p_payment_submission_id: paymentId });
    setBusyId("");
    if (cancelError) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="table-scroll">
      {error ? <p className="form-message form-message--error" role="alert">{t("payment.cancelError")}</p> : null}
      <table>
        <thead><tr><th>{t("payments.submitted")}</th><th>{t("payments.plan")}</th><th>{t("payments.method")}</th><th>{t("payments.amount")}</th><th>{t("payments.status")}</th><th><span className="sr-only">{t("payment.cancelRequest")}</span></th></tr></thead>
        <tbody>{payments.map((payment) => {
          const statusKey = paymentStatusKey(payment.status);
          const method = payment.payment_method === "send_money" ? t("payments.sendMoney") : payment.payment_method.replaceAll("_", " ");
          const provider = payment.provider.toLowerCase() === "bkash" ? "bKash" : payment.provider;
          const cancelled = Boolean(payment.cancelled_at);
          const canRequestCancellation = !cancelled && !payment.cancellation_requested_at && (payment.status === "pending" || payment.status === "needs_review");
          return (
            <tr key={payment.id}>
              <td>{localizeDate(payment.submitted_at, language, timeZone)}</td>
              <td>{language === "bn" ? payment.plan_snapshot?.name_bn || payment.plan_snapshot?.name || "—" : payment.plan_snapshot?.name || "—"}</td>
              <td>{provider} · {method}</td>
              <td>{localizeAmount(payment.amount, payment.currency, language)}</td>
              <td><span className="status-chip">{cancelled ? t("payment.cancelComplete") : statusKey ? t(statusKey) : payment.status.replaceAll("_", " ")}</span>{payment.receipt_uploaded_at ? <small className="payment-cancel-note">{t("payment.receiptAttachedShort")}</small> : null}{payment.cancellation_requested_at && !cancelled ? <small className="payment-cancel-note">{t("payment.cancelRequested")} · {t("payment.cancelExplainer")}</small> : null}</td>
              <td>{canRequestCancellation ? <button className="auth-quiet-action" type="button" disabled={busyId === payment.id} onClick={() => void requestCancellation(payment.id)}>{busyId === payment.id ? t("common.saving") : t("payment.cancelRequest")}</button> : null}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

export function EntitlementRecords({ entitlements, timeZone }: { entitlements: EntitlementRow[]; timeZone: string }) {
  const { language, t } = useLocale();
  return (
    <ul className="record-list">
      {entitlements.map((item, index) => {
        const statusKey = entitlementStatusKey(item.status);
        return (
          <li key={`${item.plan_id}-${index}`}>
            <span>
              <strong>{statusKey ? t(statusKey) : item.status.replaceAll("_", " ")}</strong>
              <small>{t("subscription.planReference", { reference: item.plan_id.slice(0, 8) })}</small>
            </span>
            <span>{localizeDate(item.starts_at, language, timeZone)} – {localizeDate(item.ends_at, language, timeZone)}</span>
          </li>
        );
      })}
    </ul>
  );
}
