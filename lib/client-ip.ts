// Client IP behind the reverse proxy. In production, Caddy sets X-Real-IP
// from the TCP connection (clients can't forge it). X-Forwarded-For is a
// fallback: its *last* entry was added by the closest proxy, while earlier
// entries may come from the client.
export const CLIENT_IP_HEADERS = ["x-real-ip", "x-forwarded-for"];

export function clientIpFrom(headers: Pick<Headers, "get">): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
}
