import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { SelectOrganizationList } from "@/components/organization/select-organization-list";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { getSession, listUserOrganizations } from "@/lib/tenant";
import { listTimeZones } from "@/lib/timezones";

export const metadata: Metadata = { title: "Creá tu negocio" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" aria-label="Agenda, inicio">
          <Logo size={34} />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 pb-16 sm:px-10">
        <Suspense fallback={<OnboardingSkeleton />}>
          <Onboarding />
        </Suspense>
      </main>
    </div>
  );
}

async function Onboarding() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/onboarding");

  const organizations = await listUserOrganizations(session.user.id);
  const appOrigin = new URL(env.BETTER_AUTH_URL).host;

  return (
    <>
      {organizations.length > 0 && (
        <details className="group rounded-2xl border bg-card p-4 shadow-soft">
          <summary className="cursor-pointer text-sm font-semibold">
            ¿Querés entrar a un negocio que ya creaste? ({organizations.length})
          </summary>
          <div className="mt-4">
            <SelectOrganizationList organizations={organizations} />
          </div>
        </details>
      )}
      <OnboardingWizard timezones={listTimeZones()} appOrigin={appOrigin} />
    </>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
