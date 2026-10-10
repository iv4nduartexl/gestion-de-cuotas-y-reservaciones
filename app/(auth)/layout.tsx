import { CalendarCheckIcon, MessageCircleIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { APP_TAGLINE } from "@/lib/brand";

const BENEFITS = [
  {
    icon: CalendarCheckIcon,
    title: "Turnos online",
    text: "Tus clientes reservan desde un link, sin llamarte.",
  },
  {
    icon: WalletIcon,
    title: "Cuotas al día",
    text: "Sabé quién pagó y quién debe, mes a mes.",
  },
  {
    icon: MessageCircleIcon,
    title: "Hecho para Paraguay",
    text: "Guaraníes, cédula y WhatsApp, como los usás.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-sidebar-primary/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full bg-coral/20 blur-3xl"
        />
        <Link href="/" className="relative w-fit" aria-label="Agenda, inicio">
          <Logo size={38} tone="light" />
        </Link>
        <div className="relative flex flex-col gap-8">
          <h2 className="max-w-md text-4xl leading-tight font-extrabold">{APP_TAGLINE}.</h2>
          <ul className="flex flex-col gap-5">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-[#bfdbfe]" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="font-bold">{title}</span>
                  <span className="text-sm text-[#c7d6ef]">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-[#a9bce0]">Hecho en Paraguay</p>
      </aside>

      <main className="flex flex-col items-center justify-center gap-8 bg-background px-6 py-12">
        <Link href="/" className="lg:hidden" aria-label="Agenda, inicio">
          <Logo size={36} />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
