
import { env } from "@/lib/env";
import { consoleTransport } from "./console-transport";
import type { EmailMessage, EmailTransport } from "./types";

function getTransport(): EmailTransport {
  switch (env.EMAIL_TRANSPORT) {
    case "console":
      return consoleTransport;
  }
}

export async function sendEmail(message: EmailMessage) {
  await getTransport().send({ ...message, from: env.EMAIL_FROM });
}

export type { EmailMessage, EmailTransport };
