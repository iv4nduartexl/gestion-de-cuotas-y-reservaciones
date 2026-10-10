"use client";

import { CheckIcon, UserIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { updateTeamModeAction } from "@/app/dashboard/settings/actions";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamMode } from "@/lib/business-types";
import { cn } from "@/lib/utils";

export function TeamModeForm({ teamMode }: { teamMode: TeamMode }) {
  const { state, pending, formProps } = useFormAction(updateTeamModeAction, {});
  const [selected, setSelected] = useState<TeamMode>(teamMode);

  const options: { value: TeamMode; title: string; description: string; icon: React.ReactNode }[] = [
    {
      value: "solo",
      title: "Trabajo solo/a",
      description: "Un solo horario. No hace falta configurar un equipo.",
      icon: <UserIcon className="size-5" aria-hidden="true" />,
    },
    {
      value: "team",
      title: "Somos un equipo",
      description: "Cada persona tiene su horario y sus servicios.",
      icon: <UsersIcon className="size-5" aria-hidden="true" />,
    },
  ];

  return (
    <form {...formProps} className="grid max-w-xl gap-4">
      {state.errors?.form && <FormMessage type="error">{state.errors.form}</FormMessage>}
      <input type="hidden" name="teamMode" value={selected} />
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forma de trabajo">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(option.value)}
              className={cn(
                "relative flex cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 bg-card p-4 text-left transition-all",
                active ? "border-primary ring-4 ring-primary-soft" : "border-border hover:border-primary/40",
              )}
            >
              {active && (
                <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                </span>
              )}
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{option.icon}</span>
              <span className="font-bold">{option.title}</span>
              <span className="text-sm text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>
      <div>
        <Button type="submit" disabled={pending || selected === teamMode}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
