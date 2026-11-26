export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !publishableKey) return null;
  if (!publishableKey.startsWith("sb_publishable_") && !publishableKey.startsWith("eyJ")) return null;

  try {
    const parsed = new URL(url);
    const privateIPv4 = parsed.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    const octets = privateIPv4 ? privateIPv4.slice(1).map(Number) : [];
    const isPrivateLanAddress = octets.length === 4
      && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
      && (octets[0] === 10
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
        || (octets[0] === 192 && octets[1] === 168));
    const isAllowedLanDemo = process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED === "true" && isPrivateLanAddress;
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && !isAllowedLanDemo) return null;
  } catch {
    return null;
  }

  return { url: url.replace(/\/$/, ""), publishableKey };
}
