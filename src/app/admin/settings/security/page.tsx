import { AdminSettingsStatusPage } from "@/components/admin/admin-settings-template";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security settings · Administration" };

export default function AdminSecuritySettingsPage() {
  const phoneEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLE_PHONE === "true";
  return <AdminSettingsStatusPage setting={{
    slug: "security",
    title: "Security settings",
    description: "Review the application's current access boundaries and launch-critical controls.",
    status: "Security review required",
    values: [
      ["Sign-in providers", "Google and email/password"],
      ["Phone/SMS sign-in", phoneEnabled ? "Enabled · provider readiness must be confirmed" : "Disabled"],
      ["Mandatory staff MFA", "TOTP setup and AAL2 enforcement implemented; staging confirmation pending"],
      ["Learner TOTP step-up", "Implemented locally · Auth Hook activation and staging verification pending"],
      ["Rate-limit configuration", "Managed outside this app · not verified here"],
      ["Admin role checks", "Applied to protected admin routes and database RPCs"],
      ["Audit events", "Append-only admin event history is available"],
    ],
    note: "Staff admin routes and staff database role checks require Supabase AAL2. Learners can enable TOTP in account security; migration 032 and the Supabase Custom Access Token Hook must be active before unrecognized-session gating works against hosted data APIs. Recovery ownership, rate-limit review and final OAuth origin checks remain launch gates. This screen does not change settings in Supabase Auth.",
  }} />;
}
