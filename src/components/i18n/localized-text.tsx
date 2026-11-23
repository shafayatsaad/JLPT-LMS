"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";

export function LocalizedText({
  messageKey,
  values,
}: {
  messageKey: MessageKey;
  values?: Record<string, string | number>;
}) {
  const { t } = useLocale();
  return <>{t(messageKey, values)}</>;
}
