"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { proposedAccessRows, proposedPlans } from "@/lib/access-catalog";

export function PricingPlanCards({ demoMode = false, nextPath = "/exams" }: { demoMode?: boolean; nextPath?: string }) {
  const { language, t } = useLocale();
  const numberLocale = language === "bn" ? "bn-BD" : "en";
  return (
    <div className="plan-preview-grid">
      {proposedPlans.map((plan, index) => (
        <div className={`paper-panel plan-preview-card${index === 1 ? " plan-preview-card--featured" : ""}`} key={plan.code}>
          <span className="product-small-label">{t("pricing.days", { count: new Intl.NumberFormat(numberLocale).format(plan.durationDays) })}</span>
          <h3>{t(plan.nameKey)}</h3>
          {demoMode ? (
            <>
              <p className="plan-preview-price">{t("pricing.demoPrice", { amount: `BDT ${new Intl.NumberFormat(numberLocale).format([10, 25, 50][index])}` })}</p>
              <p>{t("pricing.demoPriceHint")}</p>
              <Link className="btn btn--secondary" href={`/upgrade/bkash?next=${encodeURIComponent(nextPath)}`}>{t("pricing.demoCheckout")}</Link>
            </>
          ) : (
            <>
              <p className="plan-preview-price">{t("pricing.pricePending")}</p>
              <p>{t("pricing.priceApproval")}</p>
              <button className="btn btn--secondary" type="button" disabled aria-disabled="true">{t("pricing.purchasesClosed")}</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function PricingAccessMatrix() {
  const { t } = useLocale();
  return (
    <div className="table-scroll">
      <table className="access-matrix">
        <thead><tr><th>{t("pricing.feature")}</th><th>{t("pricing.free")}</th><th>{t("pricing.premium")}</th></tr></thead>
        <tbody>
          {proposedAccessRows.map((row) => (
            <tr key={row.featureKey}>
              <th scope="row">{t(row.featureKey)}</th>
              <td>{t(row.freeKey)}</td>
              <td><Check size={15} aria-hidden="true" />{t(row.premiumKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
