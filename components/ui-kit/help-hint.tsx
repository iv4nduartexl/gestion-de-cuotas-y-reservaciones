"use client";

import { CircleHelpIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A small "?" that explains a concept in one or two sentences. */
export function HelpHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Ayuda: ${label}`}
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CircleHelpIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed">{children}</PopoverContent>
    </Popover>
  );
}
