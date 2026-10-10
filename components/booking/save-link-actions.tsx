"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Lets clients keep their private turno link: copy it or send it to themselves. */
export function SaveLinkActions({ message }: { message: string }) {
  const link = () => window.location.href.split("#")[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar. Copiá la dirección de esta página.");
    }
  }

  function sendToMyself() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${message} ${link()}`)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-primary-soft/60 p-4 text-sm leading-relaxed">
      <p>
        <strong>Guardá este link:</strong> acá podés ver tu turno y cancelarlo si no podés venir.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          <CopyIcon aria-hidden="true" /> Copiar link
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={sendToMyself}>
          <MessageCircleIcon aria-hidden="true" /> Enviármelo por WhatsApp
        </Button>
      </div>
    </div>
  );
}
