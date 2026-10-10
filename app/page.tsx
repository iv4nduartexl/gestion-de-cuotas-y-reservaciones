import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  ClockIcon,
  MessageCircleIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    icon: CalendarCheckIcon,
    title: "Turnos online",
    text: "Compartí tu link por WhatsApp o Instagram y tus clientes reservan solos, de día o de noche.",
  },
  {
    icon: WalletIcon,
    title: "Control de cuotas",
    text: "Para gimnasios y academias: quién pagó, quién debe y cuánto, sin planillas.",
  },
  {
    icon: MessageCircleIcon,
    title: "Hecho para Paraguay",
    text: "Precios en guaraníes, cédula, teléfonos locales y un toque para escribir por WhatsApp.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo size={34} />
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
            Ingresar
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pt-10 pb-20 lg:grid-cols-2 lg:pt-16">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-coral-soft px-3 py-1 text-sm font-bold text-coral-foreground">
              Para barberías, clínicas, salones, gimnasios y academias
            </span>
            <h1 className="text-4xl leading-[1.1] font-extrabold sm:text-5xl lg:text-6xl">
              Tu agenda y tus cuotas, <span className="text-primary">en orden</span>.
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              {APP_NAME} te da un link de reservas para tus clientes y un panel simple para organizar
              turnos, horarios y pagos. Sin instalar nada.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
                Empezar gratis <ArrowRightIcon aria-hidden="true" />
              </Link>
              <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Ya tengo cuenta
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
              {["Listo en 5 minutos", "Desde el celular", "En español"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon className="size-4 text-success" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Product mock: a booking card as clients would see it. */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary-soft via-background to-coral-soft" />
            <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-lift">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-coral text-lg font-extrabold text-[#2a0a05]">
                  BD
                </span>
                <div className="flex flex-col">
                  <span className="font-bold">Barbería Don Pedro</span>
                  <span className="text-sm text-muted-foreground">Reservá tu turno</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div className="flex flex-col">
                  <span className="font-bold">Corte clásico</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ClockIcon className="size-3.5" /> 30 min
                  </span>
                </div>
                <span className="text-lg font-extrabold text-primary tabular">Gs. 50.000</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm font-semibold">
                {["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00"].map((time, i) => (
                  <span
                    key={time}
                    className={cn(
                      "rounded-xl border py-2 tabular",
                      i === 2 ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                      i === 4 && "text-muted-foreground line-through opacity-50",
                    )}
                  >
                    {time}
                  </span>
                ))}
              </div>
              <span className={cn(buttonVariants({ size: "lg" }), "w-full")}>Confirmar turno · lun 12/10 10:00</span>
            </div>
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col gap-3 rounded-2xl border bg-background p-6">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <Logo size={24} />
          <span>Hecho en Paraguay · © {APP_NAME}</span>
        </div>
      </footer>
    </div>
  );
}
