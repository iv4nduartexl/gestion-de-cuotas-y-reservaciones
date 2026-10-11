import { Suspense } from "react";

import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AppSidebar, AppSidebarSkeleton } from "@/components/dashboard/app-sidebar";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { SectionTitle } from "@/components/dashboard/section-title";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FlashToast } from "@/components/ui-kit/flash-toast";
import { getNavigation } from "@/lib/data/navigation";
import { headerItems } from "@/lib/navigation";
import { formatInZone } from "@/lib/datetime";
import { getTenantContextOrRedirect } from "@/lib/tenant";

// Static shell (sidebar frame, header) renders instantly; everything that
// reads the session streams in behind Suspense boundaries.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="bg-background">
        <div className="sticky top-0 z-20">
          <Suspense fallback={null}>
            <AdminBanner />
          </Suspense>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
            <SidebarTrigger className="-ml-1 size-10" aria-label="Abrir o cerrar menú" />
            <Suspense fallback={null}>
              <HeaderSection />
            </Suspense>
          </header>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">
          {children}
        </div>
        <Suspense fallback={null}>
          <BottomNavigation />
        </Suspense>
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function HeaderSection() {
  const ctx = await getTenantContextOrRedirect();
  return <SectionTitle items={headerItems(ctx.settings)} />;
}

async function BottomNavigation() {
  const ctx = await getTenantContextOrRedirect();
  return <MobileTabBar navigation={await getNavigation(ctx)} />;
}

async function AdminBanner() {
  const ctx = await getTenantContextOrRedirect();
  if (!ctx.impersonation) return null;
  return (
    <ImpersonationBanner
      business={ctx.organization.name}
      owner={ctx.user.name}
      until={formatInZone(ctx.impersonation.expiresAt, ctx.settings.timezone, "HH:mm")}
    />
  );
}
