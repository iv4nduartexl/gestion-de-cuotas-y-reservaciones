import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">Crear cuenta</CardTitle>
        <CardDescription>
          Registrate para administrar los turnos y cuotas de tu negocio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?&nbsp;
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          Ingresá
        </Link>
      </CardFooter>
    </Card>
  );
}
