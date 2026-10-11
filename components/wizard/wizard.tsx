"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/form-message";
import type { ActionState } from "@/lib/actions";
import { applyFix, type Fix, type Issue } from "@/lib/config-rules";
import { cn } from "@/lib/utils";
import { IssueBox } from "./issue-box";

export type WizardStep<V> = {
  id: string;
  /** Short name for the progress header ("Duración"). */
  label: string;
  /** The question, big ("¿Cuánto dura?"). */
  title: string | ((values: V) => string);
  /** Why it matters / what to do, in 1–2 sentences. */
  why: string;
  /** Skip this step for these values (e.g. "¿Quién lo hace?" in solo mode). */
  skip?: (values: V) => boolean;
  render: (props: { values: V; set: (patch: Partial<V>) => void; errors: Record<string, string> }) => React.ReactNode;
  /** Problems that block "Siguiente" (from lib/config-rules.ts). */
  issues?: (values: V) => Issue<V>[];
  /** Fields this step owns, to jump here when the server rejects one. */
  fields?: string[];
};

/**
 * One question per screen. "Siguiente" is blocked while the step has issues,
 * which come with one-tap fixes. The last screen ("Revisar") shows a plain
 * summary and a preview before saving. With `editStep`, only that step is
 * shown (editing one setting from a summary).
 */
export function Wizard<V>({
  steps: allSteps,
  initial,
  review,
  onSubmit,
  submitLabel,
  cancelHref,
  editStep,
  successMessage,
}: {
  steps: WizardStep<V>[];
  initial: V;
  /** The "Revisar" screen. */
  review: (values: V) => React.ReactNode;
  /** Server action call; return errors to stay, or redirect/succeed. */
  onSubmit: (values: V) => Promise<ActionState | undefined | void>;
  submitLabel: string;
  cancelHref: string;
  editStep?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Bumped by fix buttons so uncontrolled inputs (money) pick up the new value.
  const [revision, setRevision] = useState(0);

  const steps = allSteps.filter((step) => (editStep ? step.id === editStep : !step.skip?.(values)));
  const ids = [...steps.map((step) => step.id), ...(editStep ? [] : ["revisar"])];
  const requested = searchParams.get("paso");
  const index = Math.max(0, requested ? ids.indexOf(requested) : 0);
  const currentId = ids[index] ?? ids[0];
  const step = steps.find((s) => s.id === currentId);
  const isReview = currentId === "revisar";
  const issues = step?.issues?.(values) ?? [];
  const isLast = index === ids.length - 1;

  function go(to: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("paso", ids[to]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function set(patch: Partial<V>) {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function fix(chosen: Fix<V>) {
    setValues((current) => applyFix(current, chosen));
    setRevision((current) => current + 1);
  }

  function submit() {
    startTransition(async () => {
      const result = await onSubmit(values);
      if (result?.errors) {
        setErrors(Object.fromEntries(Object.entries(result.errors).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
        // Jump to the step that owns the rejected field.
        const field = Object.keys(result.errors).find((key) => key !== "form");
        const owner = field ? steps.findIndex((s) => s.fields?.includes(field)) : -1;
        if (owner >= 0 && !editStep) go(ids.indexOf(steps[owner].id));
      } else if (result?.message || successMessage) {
        toast.success(result?.message ?? successMessage!);
      }
    });
  }

  const visibleSteps = steps.length + (editStep ? 0 : 1);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {!editStep && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
            <span>
              Paso {index + 1} de {visibleSteps} · {isReview ? "Revisar" : step?.label}
            </span>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {ids.map((id, i) => (
              <span key={id} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={currentId}
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-5 rounded-3xl border bg-card p-5 shadow-soft sm:p-7"
          aria-labelledby="wizard-title"
        >
          <div className="flex flex-col gap-2">
            <h2 id="wizard-title" className="text-2xl font-extrabold">
              {isReview ? "Revisá antes de guardar" : typeof step?.title === "function" ? step.title(values) : step?.title}
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {isReview ? "Así va a quedar. Si algo no está bien, volvé al paso y cambialo." : step?.why}
            </p>
          </div>
          {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
          {isReview ? review(values) : <div key={revision}>{step?.render({ values, set, errors })}</div>}
          {!isReview && <IssueBox issues={issues} onFix={fix} />}
          {!isReview && step?.fields?.map((field) => errors[field] && <FormMessage key={field} type="error">{errors[field]}</FormMessage>)}
        </motion.section>
      </AnimatePresence>

      <div className="sticky bottom-24 z-10 flex items-center justify-between gap-3 md:bottom-6">
        {index > 0 && !editStep ? (
          <Button type="button" variant="outline" size="lg" className="bg-card" onClick={() => go(index - 1)}>
            <ArrowLeftIcon aria-hidden="true" /> Atrás
          </Button>
        ) : (
          <Link href={cancelHref} className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
            Cancelar
          </Link>
        )}
        {isLast ? (
          <Button type="button" size="lg" className="shadow-lift" disabled={pending || issues.length > 0} onClick={submit}>
            <CheckIcon aria-hidden="true" /> {pending ? "Guardando…" : submitLabel}
          </Button>
        ) : (
          <Button type="button" size="lg" className="shadow-lift" disabled={issues.length > 0} onClick={() => go(index + 1)}>
            Siguiente <ArrowRightIcon aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Wizard-friendly choice card (big radio). */
export function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  text,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        selected ? "border-primary bg-primary-soft/50" : "border-border bg-card hover:border-primary/40",
      )}
    >
      {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>}
      <span className="flex flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        {text && <span className="text-sm text-muted-foreground">{text}</span>}
      </span>
    </button>
  );
}
