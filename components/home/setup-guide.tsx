import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/home/progress-bar";
import { cn } from "@/lib/utils";

export type SetupStep = {
  title: string;
  why: string;
  href: string;
  cta: string;
  done: boolean;
};

/** Checklist that explains why each step matters; only the current one is expanded. */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Guía de configuración</h2>
          <p className="text-sm text-muted-foreground">
            {currentIndex === -1
              ? "¡Listo! Ya está todo configurado."
              : "Seguí estos pasos en orden. Te explicamos para qué sirve cada uno."}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-primary tabular">
          {doneCount} de {steps.length}
        </span>
      </div>
      <ProgressBar value={doneCount / steps.length} label="Progreso de la configuración" />

      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          return (
            <li key={step.title} className={cn(index > 0 && !isCurrent && "border-t")}>
              {isCurrent ? (
                <div className="my-2 flex gap-4 rounded-2xl border border-primary/25 bg-primary-soft/50 p-4 sm:p-5">
                  <StepNumber index={index} state="current" />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-base font-bold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-foreground/80">{step.why}</p>
                    <Link href={step.href} className={cn(buttonVariants(), "mt-1 w-fit")}>
                      {step.cta}
                    </Link>
                  </div>
                </div>
              ) : (
                <Link
                  href={step.href}
                  className="flex items-center gap-4 rounded-xl px-1 py-3.5 hover:bg-muted/60"
                >
                  <StepNumber index={index} state={step.done ? "done" : "todo"} />
                  <span
                    className={cn(
                      "text-[15px]",
                      step.done ? "text-muted-foreground line-through" : "font-semibold",
                    )}
                  >
                    {step.title}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepNumber({ index, state }: { index: number; state: "done" | "current" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckIcon className="size-4" strokeWidth={3} aria-label="Hecho" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
        state === "current"
          ? "bg-primary text-primary-foreground"
          : "border-2 border-input text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );
}
