// A way to reach a client. Implement this to add WhatsApp Business API, SMS...
export type OutgoingMessage = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };

export type SendResult = { ok: true; externalId?: string } | { ok: false; error: string };

export interface MessageChannel {
  id: "email" | "whatsapp_manual" | "whatsapp_api" | "sms";
  /** Automatic channels send from the scheduled job; manual ones wait in the tray. */
  automatic: boolean;
  send(message: OutgoingMessage): Promise<SendResult>;
}
