import { MessageCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/phone";

export function WhatsAppButton({
  phone,
  name,
  withLabel = false,
  className,
}: {
  phone: string;
  name: string;
  withLabel?: boolean;
  className?: string;
}) {
  return (
    <a
      href={whatsappUrl(phone)}
      target="_blank"
      rel="noreferrer"
      aria-label={withLabel ? undefined : `Escribir a ${name} por WhatsApp`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-success-soft font-semibold text-success-foreground transition-colors hover:bg-success-soft/70",
        withLabel ? "h-10 px-4 text-sm" : "size-10",
        className,
      )}
    >
      <MessageCircleIcon className="size-5" aria-hidden="true" />
      {withLabel && "WhatsApp"}
    </a>
  );
}
