import type { Metadata } from "next";
import { Suspense } from "react";

import { EmailVerifiedStatus } from "@/components/auth/email-verified-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verificación de correo" };

export default function EmailVerifiedPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold">Verificación de correo</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <EmailVerifiedStatus />
        </Suspense>
      </CardContent>
    </Card>
  );
}
