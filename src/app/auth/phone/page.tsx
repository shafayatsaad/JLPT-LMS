import { redirect } from "next/navigation";
import { AuthPhoneVerification } from "@/components/auth-phone-verification";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify phone · JLPT practice" };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/dashboard" } = await searchParams;
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/auth/phone?next=${safeNext}`)}`);
  if (user.phone && user.phone_confirmed_at) redirect(safeNext);

  return <ProductPage eyebrow="Account verification" title="Verify your phone number" description="Add a verified mobile number to protect your account and continue to your requested page." className="product-page--auth"><ProductSection title="One-time verification"><PaperPanel className="auth-panel"><AuthPhoneVerification /></PaperPanel></ProductSection></ProductPage>;
}
