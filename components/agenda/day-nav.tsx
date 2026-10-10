"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/forms/py-inputs";
import { buttonVariants } from "@/components/ui/button";
import { addDaysToDate, formatCalendarDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export function AgendaDayNav({
  date,
  today,
  hrefFor,
}: {
  date: string;
  today: string;
  /** Builds the URL for another date, keeping other filters. */
  hrefFor: Record<"prev" | "next" | "today", string> & { base: string };
}) {
  const router = useRouter();
  const label = date === today ? "Hoy" : date === addDaysToDate(today, 1) ? "Mañana" : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-2xl border bg-card p-1 shadow-soft">
        <Link href={hrefFor.prev} aria-label="Día anterior" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ChevronLeftIcon />
        </Link>
        <span className="min-w-44 px-2 text-center text-[15px] font-bold first-letter:uppercase">
          {label ? `${label}, ` : ""}
          {formatCalendarDate(date, "EEEE d 'de' MMMM")}
        </span>
        <Link href={hrefFor.next} aria-label="Día siguiente" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ChevronRightIcon />
        </Link>
      </div>
      {date !== today && (
        <Link href={hrefFor.today} className={cn(buttonVariants({ variant: "soft" }))}>
          Hoy
        </Link>
      )}
      <div className="w-48">
        <DatePicker
          name="agendaDate"
          value={date}
          onChange={(value) => {
            const url = new URL(hrefFor.base, window.location.origin);
            url.searchParams.set("fecha", value);
            router.push(`${url.pathname}${url.search}`);
          }}
        />
      </div>
    </div>
  );
}
