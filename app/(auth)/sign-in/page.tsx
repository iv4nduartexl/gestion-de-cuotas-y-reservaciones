import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Ingresar" };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">Ingresar</CardTitle>
        <CardDescription>Accedé al panel de tu negocio.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams needs a Suspense boundary */}
        <Suspense>
          <SignInForm />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        ¿No tenés cuenta?&nbsp;
        <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
          Registrate
        </Link>
      </CardFooter>
    </Card>
  );
}
