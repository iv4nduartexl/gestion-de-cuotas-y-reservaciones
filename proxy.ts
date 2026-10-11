import { NextResponse, type NextRequest } from "next/server";

import { isAdminIdentity } from "@/lib/admin-access";
import { auth } from "@/lib/auth";

// Runs on the Node.js runtime (Next 16 default for proxy), before rendering.
// Redirecting here, instead of inside a page, matters with Cache Components:
// a page that redirects while streaming stays mounted in a hidden <Activity>
// and can replay that redirect when shown again.
//
// This is a coarse gate. getTenantContext() still verifies the membership on
// every server render and action.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/dashboard") && !session.session.activeOrganizationId) {
    // The developer admin doesn't need a business of their own.
    const home = isAdminIdentity(session.user, session.session) ? "/admin" : "/onboarding";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/admin/:path*"],
};
