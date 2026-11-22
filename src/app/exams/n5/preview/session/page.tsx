import { N5PreviewExam } from "@/components/n5-preview-exam";
import { ExamPreviewShell } from "@/components/product-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "N5 exam interface · preview" };

export default function N5PreviewSessionPage() {
  return <ExamPreviewShell><N5PreviewExam /></ExamPreviewShell>;
}
