import { env } from "@/lib/env";
import { consoleTransport } from "./console-transport";
import { createSmtpTransport } from "./smtp-transport";
import type { EmailMessage, EmailTransport } from "./types";

let smtp: EmailTransport | undefined;

function getTransport(): EmailTransport {
  switch (env.EMAIL_TRANSPORT) {
    case "console":
      return consoleTransport;
    case "smtp":
      // env validation guarantees the SMTP settings exist here.
      smtp ??= createSmtpTransport({
        host: env.SMTP_HOST!,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE === "true",
        user: env.SMTP_USER!,
        password: env.SMTP_PASSWORD!,
        // Local SMTP catchers (Mailpit) have no TLS; production always requires it.
        requireTls: env.DEPLOYMENT === "production",
      });
      return smtp;
  }
}

export async function sendEmail(message: EmailMessage) {
  await getTransport().send({ ...message, from: env.EMAIL_FROM });
}

export type { EmailMessage, EmailTransport };
