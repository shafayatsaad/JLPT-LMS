import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { BkashPaymentCheckout, type PaymentCheckoutOptions } from "@/components/bkash-payment-checkout";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "bKash Send Money · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function BkashUpgradePage() {
  const { supabase, user } = await requireSignedInUser("/upgrade/bkash");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace · payment setup" title="bKash Send Money" description="Sign in before viewing payment options." eyebrowKey="paymentCheckout.eyebrow" titleKey="paymentCheckout.title" descriptionKey="paymentCheckout.description">
        <ProductSection title="Account access" titleKey="exams.accountAccess">
          <PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fupgrade%2Fbkash"><LocalizedText messageKey="exams.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.rpc("get_payment_checkout_options"),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const options = data && typeof data === "object" ? data as unknown as PaymentCheckoutOptions : null;

  return (
    <ProductPage eyebrow="Learner workspace · payment setup" title="bKash Send Money" description="Submit payment details only after following the verified account instructions shown on this page." eyebrowKey="paymentCheckout.eyebrow" titleKey="paymentCheckout.title" descriptionKey="paymentCheckout.description" className="product-page--dashboard">
      <ProductSection title="Payment options" titleKey="paymentCheckout.section" className="product-section--tint">
        <PaperPanel className="data-panel"><BkashPaymentCheckout options={options} setupError={Boolean(error)} timeZone={profile?.preferred_timezone || "Asia/Dhaka"} /></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
