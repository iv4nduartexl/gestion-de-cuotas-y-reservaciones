import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createStaffAction } from "@/app/dashboard/staff/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { StaffForm } from "@/components/staff/staff-form";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { requireProduct } from "@/lib/actions";
import { listOrganizationMembers } from "@/lib/data/staff";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Agregar persona" };

export default function NewStaffPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <NewStaff />
    </Suspense>
  );
}

async function NewStaff() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  if (ctx.settings.teamMode !== "team") notFound();
  const members = await listOrganizationMembers(ctx);
  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/staff", label: "Equipo" }}
        title="Agregar persona"
        description="Después de agregarla vas a poder configurar su horario."
      />
      <SectionCard title="Datos">
        <StaffForm action={createStaffAction} members={members} submitLabel="Agregar al equipo" />
      </SectionCard>
    </>
  );
}
