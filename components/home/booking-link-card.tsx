"use client";

import { CopyIcon, LinkIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingLinkCard({ url, businessName }: { url: string; businessName: string }) {
  const display = url.replace(/^https?:\/\//, "");
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Reservá tu turno en ${businessName}: ${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
    }
  }

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-lift">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sidebar-primary/30 blur-2xl"
      />
      <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#bfdbfe] uppercase">
        <LinkIcon className="size-4" aria-hidden="true" />
        Tu link de reservas
      </span>
      <span className="text-lg font-bold break-all">{display}</span>
      <p className="text-sm leading-relaxed text-[#c7d6ef]">
        Tus clientes van a elegir servicio, día y hora desde acá, sin llamarte. Lo activamos
        muy pronto; ya podés guardarlo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy} className="bg-white text-sidebar hover:bg-white/90">
          <CopyIcon aria-hidden="true" /> Copiar link
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
        >
          <MessageCircleIcon className="size-4" aria-hidden="true" /> Enviar por WhatsApp
        </a>
      </div>
    </section>
  );
}
