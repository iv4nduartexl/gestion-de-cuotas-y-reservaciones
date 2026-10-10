import { MessageCircleIcon } from "lucide-react";

import { renderReminder } from "@/lib/billing";
import { formatCalendarDate } from "@/lib/datetime";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/membership-constants";
import { formatMoney } from "@/lib/money";
import { whatsappUrl } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** WhatsApp link with the reminder text already filled in. */
export function ReminderLink({
  charge,
  template,
  withLabel = false,
}: {
  charge: { clientName: string; clientPhone: string; planName: string; remaining: number; currency: string; dueDate: string };
  template: string | null;
  withLabel?: boolean;
}) {
  const text = renderReminder(template || DEFAULT_REMINDER_TEMPLATE, {
    nombre: charge.clientName.split(" ")[0],
    plan: charge.planName,
    monto: formatMoney(charge.remaining, charge.currency),
    vencimiento: formatCalendarDate(charge.dueDate, "dd/MM/yyyy"),
  });
  return (
    <a
      href={whatsappUrl(charge.clientPhone, text)}
      target="_blank"
      rel="noreferrer"
      aria-label={withLabel ? undefined : `Recordar a ${charge.clientName} por WhatsApp`}
      title="Recordar por WhatsApp"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-success-soft font-semibold text-success-foreground hover:bg-success-soft/70",
        withLabel ? "h-10 px-4 text-sm" : "size-9",
      )}
    >
      <MessageCircleIcon className="size-4" aria-hidden="true" />
      {withLabel && "Recordar por WhatsApp"}
    </a>
  );
}
