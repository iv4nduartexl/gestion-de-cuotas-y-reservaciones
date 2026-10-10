import nodemailer from "nodemailer";

import type { EmailTransport } from "./types";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** Refuse to send without encryption (always on in production). */
  requireTls: boolean;
};

/**
 * Production transport: any SMTP provider (Brevo, Zoho, Google Workspace,
 * Amazon SES...). Connections are pooled and reused across emails.
 */
export function createSmtpTransport(config: SmtpConfig): EmailTransport {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // true = TLS from the start (port 465); false = STARTTLS upgrade (587).
    secure: config.secure,
    requireTLS: !config.secure && config.requireTls,
    auth: { user: config.user, pass: config.password },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return {
    async send(message) {
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.headers,
      });
    },
  };
}
