import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ResendVerification } from "@/components/auth/resend-verification";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Verificá tu correo" };

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">Verificá tu correo</CardTitle>
        <CardDescription>Falta un paso para activar tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ResendVerification />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </CardFooter>
    </Card>
  );
}
