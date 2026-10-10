import { setEmailOptOut } from "@/lib/data/email-preferences";

// One-click unsubscribe (RFC 8058): mail apps POST here from the
// List-Unsubscribe header. A GET (e.g. link scanners) never unsubscribes.
export async function POST(_request: Request, { params }: RouteContext<"/api/baja/[token]">) {
  const ok = await setEmailOptOut((await params).token, true);
  return new Response(ok ? "OK" : "Not found", { status: ok ? 200 : 404 });
}
