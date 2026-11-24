import { notFound } from "next/navigation";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { PaymentReviewQueue, type AdminPaymentQueueRow } from "@/components/admin/payment-admin-workflows";
import { requireSignedInUser, requireStaffMfa } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return { title: `Payment ${paymentId.slice(0, 8)} · Administration` };
}

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) notFound();

  const { supabase, user } = await requireSignedInUser(`/admin/payments/${paymentId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Payment review" description="Connect Supabase and sign in with a payment reviewer account to load this request."><ProductSection title="Supabase setup required"><PaperPanel><p>Payment review requires an authenticated staff account with the payment reviewer or admin role.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = roleRows?.map((row) => row.role as string) ?? [];
  if (roleError || !roles.some((role) => role === "admin" || role === "payment_reviewer")) {
    return <ProductPage eyebrow="Staff workspace" title="Payment reviewer access required" description="This private payment record is available to payment reviewers and administrators."><ProductSection title="Access restricted"><PaperPanel><p>Return to the learner dashboard or ask the project administrator to assign the appropriate staff role.</p></PaperPanel></ProductSection></ProductPage>;
  }
  await requireStaffMfa(supabase, `/admin/payments/${paymentId}`);

  const { data, error } = await supabase.rpc("get_admin_payment_review_queue", {
    p_status: null,
    p_from_date: null,
    p_to_date: null,
    p_search: paymentId,
  });
  if (!error) {
    const row = ((data ?? []) as AdminPaymentQueueRow[]).find((candidate) => candidate.id === paymentId);
    if (!row) notFound();
    return <ProductPage eyebrow="Staff workspace · payment review" title="Payment request" description="Verify this transfer against the trusted bKash account record before making an audited decision." className="product-page--admin" navigation={<AdminNavigation activePath={`/admin/payments/${paymentId}`} currentTitle="Payment details" roles={roles} />}><ProductSection title="Request and verification"><PaperPanel className="data-panel"><PaymentReviewQueue initialRows={[row]} initialPaymentId={paymentId} detailOnly /></PaperPanel></ProductSection></ProductPage>;
  }

  return <ProductPage eyebrow="Staff workspace · payment review" title="Payment review unavailable" description="The payment review database workflow could not be loaded."><ProductSection title="Database setup required"><PaperPanel><p>Confirm that migration 022 is applied to this Supabase project and that the staff role is active.</p></PaperPanel></ProductSection></ProductPage>;
}
