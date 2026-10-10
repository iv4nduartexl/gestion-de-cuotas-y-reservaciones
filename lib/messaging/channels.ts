import { sendEmail } from "@/lib/email";
import type { MessageChannel } from "./types";

export const emailChannel: MessageChannel = {
  id: "email",
  automatic: true,
  async send(message) {
    try {
      await sendEmail(message);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
};

/** Never sends by itself: the business taps "Enviar por WhatsApp" in the tray. */
export const whatsappManualChannel: MessageChannel = {
  id: "whatsapp_manual",
  automatic: false,
  async send() {
    return { ok: false, error: "Los recordatorios por WhatsApp se envían desde la bandeja." };
  },
};

function notConfigured(id: MessageChannel["id"]): MessageChannel {
  return {
    id,
    automatic: true,
    async send() {
      return { ok: false, error: `Canal ${id} no configurado.` };
    },
  };
}

/** Plug real implementations here (e.g. Meta WhatsApp Cloud API) without touching the jobs. */
export const CHANNELS: Record<MessageChannel["id"], MessageChannel> = {
  email: emailChannel,
  whatsapp_manual: whatsappManualChannel,
  whatsapp_api: notConfigured("whatsapp_api"),
  sms: notConfigured("sms"),
};
