import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getPaymentSheetReadiness,
  paymentSheetErrorCode,
  upsertPaymentRows,
  type PaymentSheetRow,
} from "@/lib/google-sheets";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export type PaymentSheetSyncRunResult = {
  state: "disabled" | "configuration_incomplete" | "service_unavailable" | "processed" | "empty";
  claimed: number;
  synced: number;
  failed: number;
  simulated?: boolean;
};

export async function processPaymentSheetSyncBatch(): Promise<PaymentSheetSyncRunResult> {
  const simulated = isLocalDemoEnvironment();
  if (!simulated && process.env.GOOGLE_SHEETS_SYNC_ENABLED !== "true") {
    return { state: "disabled", claimed: 0, synced: 0, failed: 0 };
  }

  const readiness = getPaymentSheetReadiness();
  if (!simulated && !readiness.configured) {
    return { state: "configuration_incomplete", claimed: 0, synced: 0, failed: 0 };
  }

  const service = createSupabaseServiceClient();
  if (!service) return { state: "service_unavailable", claimed: 0, synced: 0, failed: 0 };

  const { data, error } = await service.rpc("claim_payment_sheet_sync_batch", { p_limit: 25 });
  if (error) {
    return { state: "service_unavailable", claimed: 0, synced: 0, failed: 0 };
  }
  const rows = (data ?? []) as unknown as PaymentSheetRow[];
  if (rows.length === 0) return { state: "empty", claimed: 0, synced: 0, failed: 0, simulated };

  let batchError: ReturnType<typeof paymentSheetErrorCode> | null = null;
  if (!simulated) {
    try {
      await upsertPaymentRows(rows);
    } catch (error) {
      batchError = paymentSheetErrorCode(error);
    }
  }

  const completions = await Promise.all(rows.map(async (row) => {
    const synced = batchError === null;
    const { data: completed, error: completionError } = await service.rpc("complete_payment_sheet_sync", {
      p_payment_submission_id: row.payment_submission_id,
      p_revision: row.revision,
      p_lease_token: row.lease_token,
      p_success: synced,
      p_error_code: batchError,
    });
    return !completionError && completed === true && synced;
  }));

  const synced = completions.filter(Boolean).length;
  const failed = rows.length - synced;
  return { state: "processed", claimed: rows.length, synced, failed, simulated };
}

