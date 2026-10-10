import type { EmailTransport } from "./types";

// Development transport: prints the email to the server console.
export const consoleTransport: EmailTransport = {
  async send(message) {
    console.info(
      [
        "",
        "──────── 📧 Email (console transport) ────────",
        `From:    ${message.from}`,
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  },
};
