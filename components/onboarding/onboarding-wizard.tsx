"use client";

import {
  CalendarCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  DumbbellIcon,
  FlowerIcon,
  GraduationCapIcon,
  type LucideIcon,
  PaletteIcon,
  ScissorsIcon,
  StethoscopeIcon,
  StoreIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";

import { createBusiness, type CreateBusinessState } from "@/app/onboarding/actions";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useFormAction } from "@/hooks/use-form-action";
import {
  BUSINESS_TYPE_INFO,
  BUSINESS_TYPES,
  type BusinessType,
  type TeamMode,
} from "@/lib/business-types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { SLUG_MAX_LENGTH, slugify } from "@/lib/slug";
import { FEATURED_TIME_ZONES } from "@/lib/timezones";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<BusinessType, LucideIcon> = {
  barberia: ScissorsIcon,
  salon: PaletteIcon,
  clinica: StethoscopeIcon,
  estetica: FlowerIcon,
  gimnasio: DumbbellIcon,
  academia: GraduationCapIcon,
  otro: StoreIcon,
};

const STEP_FOR_FIELD: Record<string, number> = {
  businessType: 0,
  products: 0,
  name: 1,
  slug: 1,
  timezone: 1,
  teamMode: 2,
};

const initialState: CreateBusinessState = {};

export function OnboardingWizard({
  timezones,
  appOrigin,
}: {
  timezones: string[];
  appOrigin: string;
}) {
  const { state, pending, formProps } = useFormAction(createBusiness, initialState);
  const errors = state.errors ?? {};
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [appointments, setAppointments] = useState(true);
  const [memberships, setMemberships] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [teamMode, setTeamMode] = useState<TeamMode>("solo");

  // When the server rejects a field, jump back to the step that shows it.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    const fields = Object.keys(state.errors ?? {});
    const target = Math.min(...fields.map((field) => STEP_FOR_FIELD[field] ?? step));
    if (Number.isFinite(target)) setStep(target);
    if (state.errors?.slug || state.errors?.timezone) setShowAdvanced(true);
  }

  const totalSteps = appointments ? 3 : 2;
  const lastStep = totalSteps - 1;
  const canContinue = step === 0 ? businessType !== null && (appointments || memberships) : step === 1 ? name.trim().length >= 2 : true;

  function chooseType(type: BusinessType) {
    setBusinessType(type);
    setAppointments(BUSINESS_TYPE_INFO[type].appointments);
    setMemberships(BUSINESS_TYPE_INFO[type].memberships);
  }

  function next() {
    if (canContinue && step < lastStep) setStep(step + 1);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Enter moves forward until the last step.
    if (step < lastStep) {
      event.preventDefault();
      next();
      return;
    }
    formProps.onSubmit(event);
  }

  const linkPreview = `${appOrigin}/${slug || "tu-negocio"}`;

  return (
    <form action={formProps.action} onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-8">
      <input type="hidden" name="businessType" value={businessType ?? ""} />
      <input type="hidden" name="appointmentsEnabled" value={String(appointments)} />
      <input type="hidden" name="membershipsEnabled" value={String(memberships)} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="customSlug" value={String(customSlug)} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="teamMode" value={teamMode} />

      <StepIndicator step={step} total={totalSteps} />

      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-8"
        >
          {step === 0 && (
            <>
              <StepTitle
                title="¿Qué tipo de negocio tenés?"
                description="Así preparamos Agenda para vos: las secciones y las palabras se adaptan a tu rubro. Podés cambiarlo después."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Tipo de negocio">
                {BUSINESS_TYPES.map((type) => {
                  const info = BUSINESS_TYPE_INFO[type];
                  const Icon = TYPE_ICONS[type];
                  const selected = businessType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseType(type)}
                      className={cn(
                        "flex min-h-40 cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft",
                        selected ? "border-primary ring-4 ring-primary-soft" : "border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-12 items-center justify-center rounded-xl transition-colors",
                          selected ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
                        )}
                      >
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="text-base font-bold">{info.label}</span>
                      <span className="text-sm leading-snug text-muted-foreground">{info.hint}</span>
                    </button>
                  );
                })}
              </div>
              {errors.businessType && <p className="text-sm text-destructive">{errors.businessType}</p>}

              {businessType && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-base font-bold">¿Qué vas a usar?</h2>
                  <ProductToggle
                    icon={CalendarCheckIcon}
                    title="Turnos online"
                    description="Tus clientes reservan desde tu link, sin llamarte. Vos ves tu agenda del día."
                    checked={appointments}
                    onCheckedChange={setAppointments}
                  />
                  <ProductToggle
                    icon={WalletIcon}
                    title="Cuotas y membresías"
                    description="Controlá quién pagó y quién debe la cuota del mes. Muy pronto; ya podés ir cargando tus clientes."
                    checked={memberships}
                    onCheckedChange={setMemberships}
                  />
                  {errors.products && <p className="text-sm text-destructive">{errors.products}</p>}
                  {!appointments && !memberships && (
                    <p className="text-sm text-destructive">Elegí al menos una opción.</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <StepTitle
                title="¿Cómo se llama tu negocio?"
                description="Es el nombre que van a ver tus clientes."
              />
              <div className="flex max-w-xl flex-col gap-5">
                <FormField
                  name="nameInput"
                  label="Nombre del negocio"
                  placeholder="Barbería Don Pedro"
                  value={name}
                  autoFocus
                  autoComplete="organization"
                  maxLength={80}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!customSlug) setSlug(slugify(event.target.value));
                  }}
                  error={errors.name}
                />

                {appointments && (
                  <div className="flex flex-col gap-1 rounded-2xl bg-primary-soft/60 p-4">
                    <span className="text-xs font-bold tracking-wide text-primary-soft-foreground uppercase">
                      Tu link de reservas
                    </span>
                    <span className="font-semibold break-all">{linkPreview}</span>
                    <span className="text-sm text-muted-foreground">
                      Lo vas a compartir por WhatsApp o Instagram para que te reserven.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  aria-expanded={showAdvanced}
                  className="flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ChevronDownIcon
                    className={cn("size-4 transition-transform", showAdvanced && "rotate-180")}
                    aria-hidden="true"
                  />
                  Opciones avanzadas
                </button>

                {showAdvanced && (
                  <div className="flex flex-col gap-5 rounded-2xl border bg-card p-4">
                    <FormField
                      name="slugInput"
                      label="Link"
                      value={slug}
                      maxLength={SLUG_MAX_LENGTH}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setCustomSlug(true);
                        setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"));
                      }}
                      error={errors.slug}
                      hint="Solo letras minúsculas, números y guiones."
                    />
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="timezoneInput">Zona horaria</Label>
                      <NativeSelect
                        id="timezoneInput"
                        className="w-full"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                      >
                        <NativeSelectOptGroup label="Más usadas">
                          {FEATURED_TIME_ZONES.map((zone) => (
                            <NativeSelectOption key={zone.value} value={zone.value}>
                              {zone.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelectOptGroup>
                        <NativeSelectOptGroup label="Todas">
                          {timezones.map((zone) => (
                            <NativeSelectOption key={zone} value={zone}>
                              {zone.replaceAll("_", " ")}
                            </NativeSelectOption>
                          ))}
                        </NativeSelectOptGroup>
                      </NativeSelect>
                      {errors.timezone && <p className="text-sm text-destructive">{errors.timezone}</p>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && appointments && (
            <>
              <StepTitle
                title="¿Trabajás solo/a o con un equipo?"
                description="Si son varios, cada persona tiene su propio horario. Podés cambiarlo cuando quieras."
              />
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forma de trabajo">
                <ChoiceCard
                  icon={UserIcon}
                  title="Trabajo solo/a"
                  description="Vos atendés todos los turnos. Configurás un solo horario."
                  selected={teamMode === "solo"}
                  onSelect={() => setTeamMode("solo")}
                />
                <ChoiceCard
                  icon={UsersIcon}
                  title="Somos un equipo"
                  description="Varias personas atienden, cada una con su horario y sus servicios."
                  selected={teamMode === "team"}
                  onSelect={() => setTeamMode("team")}
                />
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {step < lastStep ? (
          // Distinct keys: reusing one <button> and flipping its type to
          // "submit" mid-click makes the browser submit the form early.
          <Button key="next" type="button" size="lg" onClick={next} disabled={!canContinue}>
            Continuar
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={pending || !canContinue}>
            {pending ? "Creando…" : "Crear mi negocio"}
          </Button>
        )}
      </div>
    </form>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Paso ${step + 1} de ${total}`}>
      <span className="text-sm font-semibold text-muted-foreground">
        Paso {step + 1} de {total}
      </span>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-8 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-input")}
          />
        ))}
      </div>
    </div>
  );
}

function StepTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ProductToggle({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label className="flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 font-normal leading-normal">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </Label>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 bg-card p-5 text-left transition-all hover:border-primary/40",
        selected ? "border-primary ring-4 ring-primary-soft" : "border-border",
      )}
    >
      {selected && (
        <span className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-4" aria-hidden="true" />
        </span>
      )}
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="text-lg font-bold">{title}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}
