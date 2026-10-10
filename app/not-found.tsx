import { CompassIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CompassIcon className="size-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold">Página no encontrada</h1>
      <p className="max-w-sm text-muted-foreground">La página que buscás no existe o no tenés acceso.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Ir al panel
      </Link>
    </main>
  );
}
