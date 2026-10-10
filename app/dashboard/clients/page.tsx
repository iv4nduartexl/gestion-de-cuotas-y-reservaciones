import { PlusIcon, SearchIcon, UserRoundPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { WhatsAppButton } from "@/components/clients/whatsapp-button";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Pagination } from "@/components/dashboard/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { listClients } from "@/lib/data/clients";
import { formatCi } from "@/lib/document";
import { formatPhone } from "@/lib/phone";
import { getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { clientSearchSchema } from "@/lib/validation/clients";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ClientList searchParams={searchParams} />
    </Suspense>
  );
}

async function ClientList({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/clients">["searchParams"];
}) {
  const ctx = await getTenantContextOrRedirect();
  const words = vocabularyFor(ctx.settings.businessType).client;
  const { q, page, archived } = clientSearchSchema.parse(await searchParams);
  const showArchived = archived === "1";
  const result = await listClients(ctx, { q, page, archived: showArchived });

  const hrefFor = (params: { page?: number; archived?: boolean }) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (params.archived ?? showArchived) search.set("archived", "1");
    if (params.page && params.page > 1) search.set("page", String(params.page));
    const query = search.toString();
    return `/dashboard/clients${query ? `?${query}` : ""}`;
  };

  const newHref = "/dashboard/clients/new";
  const isEmptyBusiness = result.total === 0 && !q && !showArchived;
  // Everyone archived is not the same as "no clients yet": offer the way back.
  const archivedCount = isEmptyBusiness ? (await listClients(ctx, { archived: true })).total : 0;

  return (
    <>
      <PageHeader
        title={capitalize(words.many)}
        description={`Las personas que te visitan, con su contacto y C.I. a mano.`}
        actions={
          !isEmptyBusiness && (
            <Link href={newHref} className={buttonVariants()}>
              <PlusIcon aria-hidden="true" /> Agregar {words.one}
            </Link>
          )
        }
      />

      {isEmptyBusiness ? (
        <EmptyState
          icon={UserRoundPlusIcon}
          title={archivedCount > 0 ? `No tenés ${words.many} activos` : `Todavía no cargaste ${words.many}`}
          description={`Guardá a las personas que te visitan para tener su teléfono a mano, escribirles por WhatsApp con un toque y, más adelante, enviarles recordatorios.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={newHref} className={buttonVariants({ size: "lg" })}>
                <PlusIcon aria-hidden="true" /> Agregar {words.one}
              </Link>
              {archivedCount > 0 && (
                <Link href={hrefFor({ archived: true, page: 1 })} className={buttonVariants({ size: "lg", variant: "outline" })}>
                  Ver archivados ({archivedCount})
                </Link>
              )}
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form className="flex w-full gap-2 sm:max-w-md" role="search">
              {showArchived && <input type="hidden" name="archived" value="1" />}
              <label className="relative flex-1">
                <span className="sr-only">Buscar {words.many}</span>
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Nombre, teléfono o C.I."
                  aria-label={`Buscar ${words.many}`}
                  className="pl-9"
                />
              </label>
              <button type="submit" className={buttonVariants({ variant: "outline" })}>
                Buscar
              </button>
            </form>
            <div className="flex gap-2" role="group" aria-label="Filtrar">
              <FilterChip href={hrefFor({ archived: false, page: 1 })} active={!showArchived}>
                Activos
              </FilterChip>
              <FilterChip href={hrefFor({ archived: true, page: 1 })} active={showArchived}>
                Archivados
              </FilterChip>
            </div>
          </div>

          {result.rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              {q
                ? `No encontramos ${words.many} con “${q}”. Probá con parte del nombre o el teléfono.`
                : `No hay ${words.many} archivados.`}
            </p>
          ) : (
            <>
              {/* Phones: cards */}
              <ul className="flex flex-col gap-2.5 md:hidden">
                {result.rows.map((client) => (
                  <li key={client.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft">
                    <Link href={`/dashboard/clients/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <EntityAvatar name={client.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-bold">{client.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {formatPhone(client.phone)}
                          {client.documentNumber && ` · C.I. ${formatCi(client.documentNumber)}`}
                        </span>
                      </span>
                    </Link>
                    <WhatsAppButton phone={client.phone} name={client.name} />
                  </li>
                ))}
              </ul>

              {/* Larger screens: table */}
              <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>C.I.</TableHead>
                      <TableHead className="hidden lg:table-cell">Correo</TableHead>
                      <TableHead className="w-0">
                        <span className="sr-only">WhatsApp</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className="flex items-center gap-3 font-bold hover:text-primary"
                          >
                            <EntityAvatar name={client.name} size="sm" />
                            {client.name}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular">{formatPhone(client.phone)}</TableCell>
                        <TableCell className="tabular">
                          {client.documentNumber ? formatCi(client.documentNumber) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {client.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <WhatsAppButton phone={client.phone} name={client.name} className="size-9" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <Pagination page={result.page} pageCount={result.pageCount} hrefForPage={(page) => hrefFor({ page })} />
        </div>
      )}
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
