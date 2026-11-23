"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminUserRow = { user_id: string; email: string | null; display_name: string | null; registered_at: string; roles: string[] };
const manageableRoles = ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"];

export function UserRoleManager({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("content_editor");
  const [filter, setFilter] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function manage(targetUserId: string, targetRole: string, action: "grant" | "revoke") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    const key = `${targetUserId}:${targetRole}`;
    setBusyKey(key);
    setError("");
    setMessage("");
    const { data, error: rpcError } = await supabase.rpc("manage_user_role", {
      p_user_id: targetUserId,
      p_role: targetRole,
      p_action: action,
    });
    setBusyKey("");
    if (rpcError) return setError(rpcError.message);
    setMessage(data ? `${targetRole.replaceAll("_", " ")} ${action === "grant" ? "granted" : "revoked"}.` : `That account already had no change for ${targetRole.replaceAll("_", " ")}.`);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId.trim())) {
      setError("Enter the account UUID shown in the directory below.");
      return;
    }
    await manage(userId.trim(), role, "grant");
  }

  const visibleRows = rows.filter((row) => `${row.email ?? ""} ${row.display_name ?? ""} ${row.user_id}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="workflow-stack">
    <p className="workflow-note"><strong>Admin only.</strong> Assign a staff role only to a known, verified account. Changes are written to the audit log; the first administrator still must be assigned in the Supabase SQL Editor.</p>
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
    <form className="workflow-form workflow-role-form" onSubmit={submit}>
      <label>Account UUID<input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Paste a registered account UUID" required /></label>
      <label>Staff role<select value={role} onChange={(event) => setRole(event.target.value)}>{manageableRoles.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <button className="btn btn--primary" type="submit" disabled={Boolean(busyKey)}>{busyKey ? "Saving…" : "Grant role"}</button>
    </form>
    <label>Filter accounts<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Email, name, or account UUID" /></label>
    {!rows.length ? <div className="empty-state"><p>No registered accounts were returned.</p></div> : <div className="workflow-user-list">{visibleRows.map((row) => <article className="workflow-user" key={row.user_id}>
      <div className="workflow-user__identity"><strong>{row.display_name || row.email || "Registered account"}</strong><span>{row.email ?? "No email on record"}</span><code>{row.user_id}</code><small>Registered {new Date(row.registered_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}</small><Link className="text-link" href={`/admin/users/${row.user_id}`}>View account details</Link></div>
      <div className="workflow-user__roles"><strong>Roles</strong><div>{row.roles.map((assignedRole) => <span className="workflow-user__role" key={assignedRole}>{assignedRole.replaceAll("_", " ")}{assignedRole !== "student" ? <button className="text-button" type="button" disabled={busyKey === `${row.user_id}:${assignedRole}`} onClick={() => void manage(row.user_id, assignedRole, "revoke")}>Remove</button> : null}</span>)}{!row.roles.length ? <span className="section-note">No role assigned</span> : null}</div></div>
    </article>)}</div>}
  </div>;
}
