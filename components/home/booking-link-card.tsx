"use client";

import { CircleAlertIcon, CopyIcon, ExternalLinkIcon, LinkIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function BookingLinkCard({
  url,
  businessName,
  missing,
}: {
  url: string;
  businessName: string;
  /** What still blocks bookings; empty = the page is live. */
  missing: string[];
}) {
  const display = url.replace(/^https?:\/\//, "");
  const live = missing.length === 0;
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
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sidebar-primary/30 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#bfdbfe] uppercase">
          <LinkIcon className="size-4" aria-hidden="true" />
          Tu link de reservas
        </span>
        <span
          className={
            live
              ? "rounded-full bg-[#86efac] px-2.5 py-0.5 text-xs font-bold text-[#14532d]"
              : "rounded-full bg-[#fcd34d] px-2.5 py-0.5 text-xs font-bold text-[#78350f]"
          }
        >
          {live ? "Activo" : "Falta configurar"}
        </span>
      </div>
      <span className="text-lg font-bold break-all">{display}</span>
      {live ? (
        <p className="text-sm leading-relaxed text-[#c7d6ef]">
          Compartilo por WhatsApp o en tu Instagram: tus clientes eligen servicio, día y hora sin llamarte.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 text-sm text-[#e6eefb]">
          <span className="text-[#c7d6ef]">Para que tus clientes puedan reservar, falta:</span>
          {missing.map((item) => (
            <span key={item} className="flex items-center gap-2">
              <CircleAlertIcon className="size-4 shrink-0 text-[#fcd34d]" aria-hidden="true" /> {item}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy} className="bg-white text-sidebar hover:bg-white/90">
          <CopyIcon aria-hidden="true" /> Copiar
        </Button>
        {live && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
          >
            <MessageCircleIcon className="size-4" aria-hidden="true" /> WhatsApp
          </a>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
        >
          <ExternalLinkIcon className="size-4" aria-hidden="true" /> Ver página
        </a>
      </div>
    </section>
  );
}
