"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";

export function LevelGuideBreadcrumb({ level }: { level: string }) {
  const { t } = useLocale();

  return (
    <nav className="product-breadcrumb" aria-label={t("levelGuide.breadcrumbNav")}>
      <Link href="/">{t("levelGuide.home")}</Link>
      <span aria-hidden="true">/</span>
      <Link href="/levels">{t("levelGuide.allLevels")}</Link>
      <span aria-hidden="true">/</span>
      <span>{t("levelGuide.breadcrumb", { level })}</span>
    </nav>
  );
}
