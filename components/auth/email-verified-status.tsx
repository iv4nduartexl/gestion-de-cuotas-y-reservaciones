"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { FormMessage } from "@/components/forms/form-message";
import { buttonVariants } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth/errors";

export function EmailVerifiedStatus() {
  const error = useSearchParams().get("error");

  if (error) {
    return (
      <div className="grid gap-4">
        <FormMessage type="error">
          {authErrorMessage({ code: error.toUpperCase() })}
        </FormMessage>
        <Link href="/verify-email" className={buttonVariants({ variant: "outline" })}>
          Pedir un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <FormMessage type="success">¡Listo! Tu correo fue verificado.</FormMessage>
      <Link href="/dashboard" className={buttonVariants()}>Continuar</Link>
    </div>
  );
}
