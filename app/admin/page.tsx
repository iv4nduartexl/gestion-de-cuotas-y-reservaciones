import { SearchIcon, ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { ImpersonateButton } from "@/components/admin/impersonate-button";
import { Logo } from "@/components/brand/logo";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Pagination } from "@/components/dashboard/pagination";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ensureAdminRole, isAdmin, listBusinesses } from "@/lib/admin";
import { BUSINESS_TYPE_INFO } from "@/lib/business-types";
import { formatInZone } from "@/lib/datetime";
import { getSession, listUserOrganizations } from "@/lib/tenant";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The admin sees dates in Paraguay time, like the businesses.
const TIMEZONE = "America/Asuncion";

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-8">
        <Link href="/admin" aria-label="Admin, inicio">
          <Logo size={30} />
        </Link>
        <AdminSignOut />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
        <Suspense fallback={<ListSkeleton rows={6} />}>
          <Businesses searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Businesses({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const session = await getSession();
  // Hidden from everyone else: it looks like any unknown page.
  if (!isAdmin(session)) notFound();
  await ensureAdminRole(session);

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number(params.page) || 1);
  const [result, own] = await Promise.all([listBusinesses({ q, page }), listUserOrganizations(session.user.id)]);
  const ownIds = new Set(own.map((org) => org.id));
  const date = (value: Date) => formatInZone(value, TIMEZONE, "dd/MM/yyyy");
  const hrefFor = (next: number) => `/admin?${new URLSearchParams({ ...(q && { q }), ...(next > 1 && { page: String(next) }) }).toString()}`;

  return (
    <>
      <PageHeader
        title="Negocios"
        description={`${result.total} negocio${result.total === 1 ? "" : "s"} registrados. Entrá a cualquiera como su dueño para probar.`}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral-foreground">
            <ShieldIcon className="size-3.5" aria-hidden="true" /> Admin · {session.user.email}
          </span>
        }
      />

      <form className="flex w-full max-w-md" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar negocios</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input name="q" type="search" defaultValue={q} placeholder="Nombre, link o correo del dueño" aria-label="Buscar negocios" className="pl-9" />
        </label>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState icon={SearchIcon} title={q ? `Nada coincide con “${q}”` : "Todavía no hay negocios"} description="Probá con otro nombre o correo." />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Negocios">
          {result.rows.map((business) => (
            <li key={business.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-bold">{business.name}</span>
                  <a href={`/${business.slug}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                    /{business.slug}
                  </a>
                </span>
                <span className="text-sm text-muted-foreground">
                  {BUSINESS_TYPE_INFO[business.businessType].label}
                  {" · "}
                  {[business.appointmentsEnabled && "Turnos", business.membershipsEnabled && "Cuotas"].filter(Boolean).join(" + ") || "Sin productos"}
                  {" · "}
                  {business.teamMode === "team" ? "Equipo" : "Solo"}
                  {" · "}creado el {date(business.createdAt)}
                </span>
                <span className="text-sm">
                  Dueño: <strong>{business.ownerName ?? "—"}</strong> <span className="text-muted-foreground">{business.ownerEmail}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular">
                  {plural(business.clients, "cliente", "clientes")} · {plural(business.upcoming, "turno próximo", "turnos próximos")} ·{" "}
                  {plural(business.activeMemberships, "membresía activa", "membresías activas")}
                  {business.lastActivity && ` · última actividad ${date(business.lastActivity)}`}
                </span>
              </div>
              {(business.ownerName || ownIds.has(business.id)) && (
                <ImpersonateButton
                  organizationId={business.id}
                  business={business.name}
                  owner={business.ownerName ?? ""}
                  own={ownIds.has(business.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {result.pageCount > 1 && <Pagination page={result.page} pageCount={result.pageCount} hrefForPage={hrefFor} />}
    </>
  );
}
