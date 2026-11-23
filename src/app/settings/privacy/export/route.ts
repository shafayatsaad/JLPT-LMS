import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRequestStepUpAccess } from "@/lib/auth-step-up";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return response(503, "Account export is unavailable until Supabase is configured.");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/auth/login?next=%2Fsettings%2Fprivacy%2Fexport", request.url), 303);
  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") return Response.redirect(new URL(`/auth/continue?next=${encodeURIComponent("/settings/privacy/export")}`, request.url), 303);
  if (stepUp === "unavailable") return response(503, "Account export is unavailable until Supabase sign-in security is configured.");

  const [profile, bookmarks, attempts, stats, reviews, practices, notifications, tickets, payments, entitlements, preferences, deletionRequests] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_bookmarks").select("*").eq("user_id", user.id),
    supabase.from("exam_attempts").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("user_question_stats").select("*").eq("user_id", user.id),
    supabase.from("user_question_reviews").select("*").eq("user_id", user.id),
    supabase.from("practice_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("payment_submissions").select("*").eq("user_id", user.id).order("submitted_at", { ascending: true }),
    supabase.from("user_entitlements").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("user_notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("account_deletion_requests").select("id,status,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  const baseResults = [profile, bookmarks, attempts, stats, reviews, practices, notifications, tickets, payments, entitlements, preferences, deletionRequests];
  if (baseResults.some((result) => result.error)) {
    console.error("Account export could not read all personal records:", baseResults.filter((result) => result.error).map((result) => result.error?.message));
    return response(503, "The complete account export is unavailable. Confirm that the current Supabase migrations are applied, then try again.");
  }

  const attemptIds = (attempts.data ?? []).map((row) => row.id);
  const practiceIds = (practices.data ?? []).map((row) => row.id);
  const ticketIds = (tickets.data ?? []).map((row) => row.id);
  const [sections, answers, results, practiceItems, messages, supportAttachments] = await Promise.all([
    attemptIds.length ? supabase.from("attempt_sections").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
    attemptIds.length ? supabase.from("attempt_answers").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
    attemptIds.length ? supabase.from("exam_results").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
    practiceIds.length ? supabase.from("practice_session_items").select("*").in("session_id", practiceIds) : Promise.resolve({ data: [], error: null }),
    ticketIds.length ? supabase.from("support_messages").select("id,ticket_id,sender_user_id,sender_side,body,created_at").in("ticket_id", ticketIds).eq("is_internal", false).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ticketIds.length ? supabase.from("support_attachments").select("message_id,stored_bytes,attached_at").in("ticket_id", ticketIds).eq("status", "attached") : Promise.resolve({ data: [], error: null }),
  ]);
  const detailResults = [sections, answers, results, practiceItems, messages, supportAttachments];
  if (detailResults.some((result) => result.error)) {
    console.error("Account export could not read all personal activity:", detailResults.filter((result) => result.error).map((result) => result.error?.message));
    return response(503, "The complete account export is unavailable. Confirm that the current Supabase migrations are applied, then try again.");
  }

  const payload = {
    format: "jlpt-account-export-v1",
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile: profile.data,
    preferences: preferences.data,
    exam_activity: {
      attempts: attempts.data ?? [],
      sections: sections.data ?? [],
      answers: answers.data ?? [],
      results: results.data ?? [],
      question_statistics: stats.data ?? [],
    },
    focused_practice: {
      sessions: practices.data ?? [],
      answers: practiceItems.data ?? [],
    },
    learning: {
      bookmarks: bookmarks.data ?? [],
      mistake_review_markers: reviews.data ?? [],
    },
    notifications: notifications.data ?? [],
    support: {
      tickets: tickets.data ?? [],
      public_messages: messages.data ?? [],
      attachment_metadata: supportAttachments.data ?? [],
    },
    payments: {
      submissions: payments.data ?? [],
      entitlements: entitlements.data ?? [],
    },
    privacy: { account_deletion_requests: deletionRequests.data ?? [] },
  };

  const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jlpt-account-export-${date}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
