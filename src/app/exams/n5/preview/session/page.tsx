import { ExamBookletRenderer } from "@/components/exam-booklet-renderer";
import { ExamPreviewShell } from "@/components/product-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "N5 exam interface · preview" };

export default function N5PreviewSessionPage() {
  return <ExamPreviewShell><ExamBookletRenderer /></ExamPreviewShell>;
}
