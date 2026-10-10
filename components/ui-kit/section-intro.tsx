"use client";

import { ArrowRightIcon, ChevronDownIcon, LightbulbIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export type SectionIntroProps = {
  section: string;
  what?: string;
  why: string;
  example?: string;
  connections: { label: string; href: string }[];
  /** Open by default while the section is empty / not configured. */
  defaultOpen: boolean;
};

const storageKey = (section: string) => `agenda:intro:${section}`;

function readStored(section: string): "open" | "closed" | null {
  try {
    const value = window.localStorage.getItem(storageKey(section));
    return value === "open" || value === "closed" ? value : null;
  } catch {
    return null; // Storage unavailable: use the default.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** "¿Para qué sirve?": what the page is for, why it matters and what it feeds into. */
export function SectionIntro({ section, what, why, example, connections, defaultOpen }: SectionIntroProps) {
  // The viewer's last choice wins over the default (server render uses the default).
  const stored = useSyncExternalStore(subscribe, () => readStored(section), () => null);
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? (stored ? stored === "open" : defaultOpen);
  const panelId = useId();

  function toggle() {
    const next = !open;
    setChoice(next);
    try {
      window.localStorage.setItem(storageKey(section), next ? "open" : "closed");
    } catch {
      // Not persisted; fine.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex w-fit items-center gap-1.5 rounded-full text-sm font-semibold text-primary hover:text-primary/80"
      >
        <LightbulbIcon className="size-4" aria-hidden="true" />
        ¿Para qué sirve?
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-primary/15 bg-primary-soft/50 p-4 text-sm leading-relaxed sm:p-5">
              {what && (
                <p>
                  <strong>Qué es:</strong> {what}
                </p>
              )}
              <p>
                <strong>Para qué te sirve:</strong> {why}
              </p>
              {example && (
                <p>
                  <strong>Ejemplo:</strong> “{example}”
                </p>
              )}
              {connections.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Se conecta con</span>
                  {connections.map((connection) => (
                    <Link
                      key={connection.href}
                      href={connection.href}
                      className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-semibold hover:border-primary hover:text-primary"
                    >
                      {connection.label}
                      <ArrowRightIcon className="size-3" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
