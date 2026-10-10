import { MailCheckIcon, MailXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmailPreference } from "@/lib/data/email-preferences";
import { EmailOptOutButton } from "./opt-out-button";

export const metadata: Metadata = {
  title: "Recordatorios por correo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function UnsubscribePage({ params }: PageProps<"/baja/[token]">) {
  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 pt-16 pb-10">
      <main className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border bg-card p-8 text-center shadow-soft">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
          <Preference params={params} />
        </Suspense>
      </main>
      <Link href="/" className="mt-8" aria-label="Agenda">
        <Logo size={20} />
      </Link>
    </div>
  );
}

async function Preference({ params }: { params: PageProps<"/baja/[token]">["params"] }) {
  const { token } = await params;
  const preference = await getEmailPreference(token);
  if (!preference) {
    return (
      <>
        <h1 className="text-xl font-extrabold">Este link no es válido</h1>
        <p className="text-sm text-muted-foreground">Puede que esté incompleto. Copialo entero desde el correo que recibiste.</p>
      </>
    );
  }
  const optedOut = preference.optedOutAt !== null;
  const Icon = optedOut ? MailXIcon : MailCheckIcon;
  return (
    <>
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-extrabold">
        {optedOut ? "Listo, no vas a recibir más correos" : `Recordatorios de ${preference.businessName}`}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {optedOut
          ? `${preference.businessName} no te va a mandar más recordatorios por correo, ${preference.firstName}. Puede que igual te avisen por WhatsApp.`
          : `Hola ${preference.firstName}, ${preference.businessName} te manda por correo recordatorios de tus turnos y cuotas. ¿Querés dejar de recibirlos?`}
      </p>
      <EmailOptOutButton token={token} optedOut={optedOut} />
    </>
  );
}
