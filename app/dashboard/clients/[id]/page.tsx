import { MailIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  setClientArchivedAction,
  updateClientAction,
} from "@/app/dashboard/clients/actions";
import { ClientForm } from "@/components/clients/client-form";
import { WhatsAppButton } from "@/components/clients/whatsapp-button";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { getClient } from "@/lib/data/clients";
import { formatCi } from "@/lib/document";
import { formatPhone } from "@/lib/phone";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cliente" };

export default function ClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}

async function ClientDetail({
  params,
}: {
  params: PageProps<"/dashboard/clients/[id]">["params"];
}) {
  const ctx = await getTenantContextOrRedirect();
  const words = vocabularyFor(ctx.settings.businessType).client;
  const id = parseId((await params).id);
  const client = id ? await getClient(ctx, id) : null;
  if (!client) notFound();

  const archived = client.archivedAt !== null;
  return (
    <>
      <PageHeader back={{ href: "/dashboard/clients", label: capitalize(words.many) }} title={client.name} />

      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:p-6">
        <EntityAvatar name={client.name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold">{client.name}</span>
            {archived && <Badge variant="neutral">Archivado</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular">
              <PhoneIcon className="size-4" aria-hidden="true" />
              {formatPhone(client.phone)}
            </span>
            {client.documentNumber && <span className="tabular">C.I. {formatCi(client.documentNumber)}</span>}
            {client.email && (
              <span className="inline-flex items-center gap-1.5">
                <MailIcon className="size-4" aria-hidden="true" />
                {client.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton phone={client.phone} name={client.name} withLabel />
          {can(ctx, { client: ["archive"] }) && (
            <ConfirmActionButton
              action={setClientArchivedAction.bind(null, client.id, !archived)}
              label={archived ? "Restaurar" : "Archivar"}
              title={archived ? `¿Restaurar ${words.one}?` : `¿Archivar ${words.one}?`}
              description={
                archived
                  ? `Vuelve a aparecer en tu lista de ${words.many}.`
                  : `Deja de aparecer en tu lista, pero no se borra nada. Podés restaurarlo cuando quieras.`
              }
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )}
        </div>
      </section>

      {can(ctx, { client: ["update"] }) ? (
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          client={{
            ...client,
            phone: formatPhone(client.phone),
            documentNumber: client.documentNumber ? formatCi(client.documentNumber) : null,
          }}
          submitLabel="Guardar cambios"
          noun={words.one}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No tenés permiso para editar {words.many}.</p>
      )}
    </>
  );
}
