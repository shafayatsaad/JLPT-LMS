import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type EntitlementNotificationRunResult = {
  state: "disabled" | "configuration_invalid" | "service_unavailable" | "processed";
  expiring_created: number;
  expired_created: number;
};

function reminderDays() {
  const configured = process.env.ENTITLEMENT_EXPIRY_REMINDER_DAYS?.trim();
  const value = configured ? Number(configured) : 7;
  return Number.isInteger(value) && value >= 1 && value <= 30 ? value : null;
}

export async function processEntitlementNotifications(): Promise<EntitlementNotificationRunResult> {
  if (process.env.ENTITLEMENT_NOTIFICATIONS_ENABLED !== "true") {
    return { state: "disabled", expiring_created: 0, expired_created: 0 };
  }

  const days = reminderDays();
  if (days === null) {
    return { state: "configuration_invalid", expiring_created: 0, expired_created: 0 };
  }

  try {
    const service = createSupabaseServiceClient();
    if (!service) return { state: "service_unavailable", expiring_created: 0, expired_created: 0 };

    const { data, error } = await service.rpc("process_entitlement_notifications", {
      p_expiring_days: days,
      p_limit: 250,
    });
    if (error || !data || typeof data !== "object") {
      return { state: "service_unavailable", expiring_created: 0, expired_created: 0 };
    }

    const counts = data as { expiring_created?: unknown; expired_created?: unknown };
    const expiringCreated = Number(counts.expiring_created);
    const expiredCreated = Number(counts.expired_created);
    if (!Number.isInteger(expiringCreated) || !Number.isInteger(expiredCreated) || expiringCreated < 0 || expiredCreated < 0) {
      return { state: "service_unavailable", expiring_created: 0, expired_created: 0 };
    }

    return {
      state: "processed",
      expiring_created: expiringCreated,
      expired_created: expiredCreated,
    };
  } catch {
    return { state: "service_unavailable", expiring_created: 0, expired_created: 0 };
  }
}
