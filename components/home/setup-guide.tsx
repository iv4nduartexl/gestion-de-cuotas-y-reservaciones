import { ArrowRightIcon, CheckIcon, ExternalLinkIcon, PartyPopperIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/home/progress-bar";
import { MILESTONES, type SetupStepDef } from "@/lib/setup-steps";
import { cn } from "@/lib/utils";

export type SetupStep = SetupStepDef & { preview?: React.ReactNode };

/**
 * Getting-started checklist in two milestones. The current step explains why
 * it matters, shows what it produces and what it unlocks.
 */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((step) => step.done).length;
  const currentIndex = steps.findIndex((step) => !step.done);

  if (currentIndex === -1) {
    return (
      <details className="group rounded-2xl border bg-card p-5 shadow-soft">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-foreground">
            <PartyPopperIcon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-bold">¡Tu negocio está listo!</span>
            <span className="text-sm text-muted-foreground">Completaste los {steps.length} pasos de la guía.</span>
          </span>
          <span className="text-sm font-semibold text-primary group-open:hidden">Ver guía otra vez</span>
          <span className="hidden text-sm font-semibold text-primary group-open:inline">Ocultar</span>
        </summary>
        <ol className="mt-4 flex flex-col">
          {steps.map((step, index) => (
            <StepRow key={step.id} step={step} index={index} />
          ))}
        </ol>
      </details>
    );
  }

  const milestones = (["build", "use"] as const)
    .map((id) => ({ id, steps: steps.map((step, index) => ({ step, index })).filter(({ step }) => step.milestone === id) }))
    .filter((milestone) => milestone.steps.length > 0);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:p-7" aria-labelledby="setup-guide-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="setup-guide-title" className="text-xl font-bold">
            Guía de configuración
          </h2>
          <p className="text-sm text-muted-foreground">Seguí estos pasos en orden. Te mostramos para qué sirve cada uno.</p>
        </div>
        <span className="shrink-0 text-sm font-bold text-primary tabular">
          {doneCount} de {steps.length}
        </span>
      </div>
      <ProgressBar value={doneCount / steps.length} label="Progreso de la configuración" />

      {milestones.map((milestone, milestoneIndex) => {
        const info = MILESTONES[milestone.id];
        const complete = milestone.steps.every(({ step }) => step.done);
        return (
          <div key={milestone.id} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {milestoneIndex + 1} · {info.title}
              </h3>
              {complete && <span className="text-xs font-semibold text-success-foreground">Completo</span>}
            </div>
            <p className="text-xs text-muted-foreground">{info.description}</p>
            <ol className="mt-1 flex flex-col">
              {milestone.steps.map(({ step, index }) =>
                index === currentIndex ? (
                  <CurrentStep key={step.id} step={step} index={index} />
                ) : (
                  <StepRow key={step.id} step={step} index={index} />
                ),
              )}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

function CurrentStep({ step, index }: { step: SetupStep; index: number }) {
  return (
    <li className="my-2">
      <div className="grid gap-5 rounded-2xl border border-primary/25 bg-primary-soft/50 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex gap-4">
          <StepNumber index={index} state="current" />
          <div className="flex flex-col gap-2">
            <h4 className="text-base font-bold">{step.title}</h4>
            <p className="text-sm leading-relaxed text-foreground/80">{step.why}</p>
            <p className="flex items-start gap-2 text-sm font-semibold text-primary-soft-foreground">
              <SparklesIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Después de esto: </span>
                {step.unlocks}
              </span>
            </p>
            <Link
              href={step.href}
              target={step.external ? "_blank" : undefined}
              className={cn(buttonVariants(), "mt-1 w-fit")}
            >
              {step.cta}
              {step.external ? <ExternalLinkIcon aria-hidden="true" /> : <ArrowRightIcon aria-hidden="true" />}
            </Link>
          </div>
        </div>
        {step.preview && <div className="md:w-60">{step.preview}</div>}
      </div>
    </li>
  );
}

function StepRow({ step, index }: { step: SetupStep; index: number }) {
  return (
    <li className="border-t first:border-t-0">
      <Link
        href={step.href}
        target={step.external ? "_blank" : undefined}
        className="flex items-center gap-4 rounded-xl px-1 py-3.5 hover:bg-muted/60"
      >
        <StepNumber index={index} state={step.done ? "done" : "todo"} />
        <span className={cn("text-[15px]", step.done ? "text-muted-foreground line-through" : "font-semibold")}>{step.title}</span>
      </Link>
    </li>
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
        state === "current" ? "bg-primary text-primary-foreground" : "border-2 border-input text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );
}
