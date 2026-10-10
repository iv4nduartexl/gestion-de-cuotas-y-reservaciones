import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">Recuperar contraseña</CardTitle>
        <CardDescription>
          Te enviaremos un enlace para elegir una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </CardFooter>
    </Card>
  );
}
