export function isLocalDemoEnvironment() {
  if (process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true") return false;
  try {
    const parsedUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const host = parsedUrl.hostname.toLowerCase();
    const octets = host.split(".").map(Number);
    const privateIPv4 = octets.length === 4
      && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
      && (octets[0] === 10
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
        || (octets[0] === 192 && octets[1] === 168));
    const publicDemoTunnel = process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED === "true"
      && parsedUrl.protocol === "https:"
      && host.endsWith(".trycloudflare.com");
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || privateIPv4 || publicDemoTunnel;
  } catch {
    return false;
  }
}

export function isLocalQaExamFormCode(formCode: string) {
  return /^N[1-5]-PHASE\d+-/i.test(formCode);
}

export function canSkipMfaForSharedRemoteDemoAdmin(email: string | null | undefined) {
  return process.env.LOCAL_DEMO_ACCOUNTS_ENABLED === "true"
    && process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED === "true"
    && email?.toLowerCase() === "public-admin@n5.test";
}
