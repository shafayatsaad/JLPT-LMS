import { OrigamiProductShell } from "@/components/product-shell";
import { N5PreviewReview } from "@/components/n5-preview-review";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "N5 sample answer review · preview" };

export default function N5PreviewReviewPage() {
  return <OrigamiProductShell><N5PreviewReview /></OrigamiProductShell>;
}
