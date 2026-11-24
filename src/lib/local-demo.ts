export function isLocalDemoEnvironment() {
  if (process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true") return false;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  } catch {
    return false;
  }
}
