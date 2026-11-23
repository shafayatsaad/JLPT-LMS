import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { PrivacyDeletionQueue, type AdminAccountDeletionRequest } from "@/components/admin/privacy-deletion-queue";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy requests · Administration" };

const statuses = ["received", "under_review", "awaiting_owner_policy", "withdrawn"] as const;

export default async function AdminPrivacyRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "";
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const { supabase } = await requireStaff(["admin"], "/admin/privacy");
  if (!supabase) {
    return <ProductPage eyebrow="Administrator workspace" title="Privacy requests unavailable" description="Connect Supabase and sign in with administrator access to review account requests."><ProductSection title="Setup required"><PaperPanel><p>Apply the reconciled database migrations before opening the privacy queue.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.rpc("get_admin_account_deletion_requests", { p_status: status || null });
  const requests = Array.isArray(data) ? data as AdminAccountDeletionRequest[] : [];

  return (
    <ProductPage eyebrow="Administrator workspace · AAL2 required" title="Account deletion requests" description="Review verified requests and record their status. This queue never performs account or data deletion." className="product-page--admin">
      <ProductSection title="Privacy request queue" className="product-section--tint">
        <PaperPanel className="data-panel">
          <form className="admin-export-form" method="get">
            <div className="admin-export-form__fields"><label>Request status<select name="status" defaultValue={status}><option value="">All requests</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label></div>
            <button className="btn btn--secondary" type="submit">Filter requests</button>
          </form>
          {error ? <p className="inline-notice">Privacy requests are unavailable. Confirm migration 029 and administrator access.</p> : <PrivacyDeletionQueue requests={requests} />}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
