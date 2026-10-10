import { MapPinIcon, MessageCircleIcon } from "lucide-react";

import { initials } from "@/components/ui-kit/entity-avatar";
import { formatPhone, whatsappUrl } from "@/lib/phone";

export function BusinessHeader({
  name,
  description,
  address,
  publicPhone,
}: {
  name: string;
  description: string | null;
  address: string | null;
  publicPhone: string | null;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-3xl bg-sidebar p-6 text-white shadow-lift">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-coral text-xl font-extrabold text-[#2a0a05]">
          {initials(name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-2xl leading-tight font-extrabold">{name}</h1>
          <span className="text-sm text-[#c7d6ef]">Reservá tu turno online</span>
        </div>
      </div>
      {description && <p className="text-sm leading-relaxed text-[#dbe6f7]">{description}</p>}
      {(address || publicPhone) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {address && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <MapPinIcon className="size-4" aria-hidden="true" /> {address}
            </span>
          )}
          {publicPhone && (
            <a
              href={whatsappUrl(publicPhone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"
            >
              <MessageCircleIcon className="size-4" aria-hidden="true" /> {formatPhone(publicPhone)}
            </a>
          )}
        </div>
      )}
    </header>
  );
}
