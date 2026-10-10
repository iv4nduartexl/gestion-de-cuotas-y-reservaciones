"use client";

import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BookingPhonePreview, CuotasPreview, WhatsAppPreview } from "@/components/illustrations/previews";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Slide = { id: string; eyebrow?: string; title: string; text: string; visual: React.ReactNode };

export type WelcomeTourProps = {
  businessName: string;
  appointments: boolean;
  memberships: boolean;
  clientWord: string; // "clientes", "socios"...
  services: { name: string; meta: string }[];
  planExample: string;
  reminderText: string;
  steps: string[];
};

/**
 * Three or four screens right after onboarding: what Agenda does for this
 * business (in its own words), then how to set it up. Skippable; reopened
 * from the user menu ("¿Qué hace Agenda?").
 */
export function WelcomeTour(props: WelcomeTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [];
  if (props.appointments) {
    slides.push({
      id: "booking",
      title: `Tus ${props.clientWord} reservan solos, las 24 horas`,
      text: "Compartís tu link de reservas por WhatsApp o Instagram. Eligen qué quieren, el horario y listo: el turno aparece en tu Agenda, sin llamadas ni mensajes.",
      visual: <BookingPhonePreview businessName={props.businessName} services={props.services} />,
    });
  }
  if (props.memberships) {
    slides.push({
      id: "cuotas",
      title: "Sabés quién pagó y quién debe, sin planillas",
      text: `Inscribís a tus ${props.clientWord} en un plan y Agenda arma sus cuotas mes a mes. Registrás cada pago en segundos y ves al toque quién está vencido.`,
      visual: <CuotasPreview plan={props.planExample.split(" · ")[0]} />,
    });
  }
  slides.push({
    id: "reminders",
    title: "Agenda les recuerda por vos",
    text: `${props.appointments ? "Un día antes de cada turno" : "Antes de que venza cada cuota"}${props.appointments && props.memberships ? " y antes de que venza cada cuota" : ""}. Si tienen correo, les llega solo; si no, te lo dejamos escrito para mandarlo por WhatsApp con un toque.`,
    visual: <WhatsAppPreview text={props.reminderText} />,
  });
  slides.push({
    id: "setup",
    title: "Así lo dejás listo",
    text: "Te guiamos paso a paso desde el Inicio. Cada paso te explica para qué sirve. Lleva unos 10 minutos.",
    visual: (
      <ol className="flex flex-col gap-2" aria-label="Pasos de la configuración">
        {props.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm font-semibold">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    ),
  });
  slides[0].eyebrow = "¡Tu negocio está creado!";

  const slide = slides[index];
  const last = index === slides.length - 1;

  function close() {
    setOpen(false);
    // Drop ?bienvenida=1 so a reload doesn't reopen the tour.
    router.replace(pathname, { scroll: false });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <div className="flex min-h-64 items-center justify-center bg-gradient-to-br from-primary-soft to-coral-soft/60 px-6 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.id}
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xs"
            >
              {slide.visual}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-3 p-6">
          {slide.eyebrow && <span className="text-sm font-bold text-coral-foreground">{slide.eyebrow}</span>}
          <DialogTitle className="text-xl leading-tight font-extrabold">{slide.title}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">{slide.text}</DialogDescription>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-label={`Pantalla ${index + 1} de ${slides.length}`} role="img">
              {slides.map((s, i) => (
                <span key={s.id} className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30")} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!last && (
                <Button variant="ghost" onClick={close}>
                  Saltar
                </Button>
              )}
              {last ? (
                <Button onClick={close}>
                  <CheckCircle2Icon aria-hidden="true" /> Empezar a configurar
                </Button>
              ) : (
                <Button onClick={() => setIndex(index + 1)}>
                  Siguiente <ArrowRightIcon aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
