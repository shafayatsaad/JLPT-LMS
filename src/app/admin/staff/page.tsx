import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff and roles · Administration" };

export default async function AdminStaffPage() {
  await requireStaff(["admin"], "/admin/staff");
  redirect("/admin/users");
}
