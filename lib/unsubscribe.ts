import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, per-client unsubscribe tokens for reminder emails. No database
// lookup is needed to validate one, and they can't be guessed or altered.
const PURPOSE = "agenda:email-unsubscribe:v1";

function signature(clientId: string, secret: string) {
  return createHmac("sha256", secret).update(`${PURPOSE}:${clientId}`).digest("base64url").slice(0, 32);
}

export function createUnsubscribeToken(clientId: string, secret: string) {
  return `${Buffer.from(clientId).toString("base64url")}.${signature(clientId, secret)}`;
}

/** The client id the token was issued for, or null if it's invalid. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const clientId = Buffer.from(encoded, "base64url").toString("utf8");
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return null;
  const expected = Buffer.from(signature(clientId, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? clientId : null;
}
