import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans & Payments · JLPT practice" };

export default function PaymentHistoryPage(): never {
  redirect("/subscription");
}
