import { Suspense } from "react";

import { AppSidebar, AppSidebarSkeleton } from "@/components/dashboard/app-sidebar";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { SectionTitle } from "@/components/dashboard/section-title";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FlashToast } from "@/components/ui-kit/flash-toast";
import { buildNavigation } from "@/lib/navigation";
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
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger className="-ml-1 size-10" aria-label="Abrir o cerrar menú" />
          <Suspense fallback={null}>
            <HeaderSection />
          </Suspense>
        </header>
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
  const navigation = buildNavigation(ctx.settings);
  return <SectionTitle items={[...navigation.main, navigation.settings]} />;
}

async function BottomNavigation() {
  const ctx = await getTenantContextOrRedirect();
  const navigation = buildNavigation(ctx.settings);
  const items = navigation.main.slice(0, 4);
  if (items.length < 4) items.push(navigation.settings);
  return <MobileTabBar items={items} />;
}
