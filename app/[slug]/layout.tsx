import Link from "next/link";

import { Logo } from "@/components/brand/logo";

// Public pages of a business (booking + private turno link).
export default function PublicBusinessLayout({ children }: LayoutProps<"/[slug]">) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6">{children}</main>
      <footer className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 px-4 pt-10 pb-32 text-xs text-muted-foreground">
        Reservas con
        <Link href="/" aria-label="Agenda">
          <Logo size={18} />
        </Link>
      </footer>
    </div>
  );
}
