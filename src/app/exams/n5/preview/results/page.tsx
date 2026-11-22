import { OrigamiProductShell } from "@/components/product-shell";
import { N5PreviewResults } from "@/components/n5-preview-results";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "N5 sample result · preview" };

export default function N5PreviewResultsPage() {
  return <OrigamiProductShell><N5PreviewResults /></OrigamiProductShell>;
}
