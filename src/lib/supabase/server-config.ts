import "server-only";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

export function getSupabaseAuthCookieName(publicUrl: string) {
  const hostname = new URL(publicUrl).hostname.toLowerCase();
  const projectRef = ["localhost", "127.0.0.1", "::1"].includes(hostname)
    ? "localhost"
    : hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

export function getSupabaseServerUrl(publicUrl: string) {
  const internalUrl = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (!internalUrl) return publicUrl;

  let parsed: URL;
  try {
    parsed = new URL(internalUrl);
  } catch {
    throw new Error("SUPABASE_INTERNAL_URL must be a valid HTTP or HTTPS URL.");
  }

  const isLocalHttp = parsed.protocol === "http:" && localHosts.has(parsed.hostname);
  if (parsed.username || parsed.password || (parsed.protocol !== "https:" && !isLocalHttp)) {
    throw new Error("SUPABASE_INTERNAL_URL must use HTTPS or a trusted local Docker host.");
  }

  return parsed.origin;
}
