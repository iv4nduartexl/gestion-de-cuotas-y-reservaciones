import type { EmailMessage } from "./types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function actionEmail(params: {
  to: string;
  subject: string;
  greetingName: string;
  intro: string;
  actionLabel: string;
  url: string;
  outro: string;
}): EmailMessage {
  const { to, subject, greetingName, intro, actionLabel, url, outro } = params;
  const text = [
    `Hola ${greetingName},`,
    "",
    intro,
    "",
    `${actionLabel}: ${url}`,
    "",
    outro,
  ].join("\n");
  const html = `
    <p>Hola ${escapeHtml(greetingName)},</p>
    <p>${escapeHtml(intro)}</p>
    <p><a href="${escapeHtml(url)}">${escapeHtml(actionLabel)}</a></p>
    <p>${escapeHtml(outro)}</p>
  `;
  return { to, subject, text, html };
}

export function verificationEmail(params: {
  to: string;
  name: string;
  url: string;
}): EmailMessage {
  return actionEmail({
    to: params.to,
    subject: "Verificá tu correo electrónico",
    greetingName: params.name,
    intro: "Gracias por registrarte. Confirmá tu correo para activar tu cuenta.",
    actionLabel: "Verificar correo",
    url: params.url,
    outro: "Si no creaste esta cuenta, podés ignorar este mensaje.",
  });
}

export function resetPasswordEmail(params: {
  to: string;
  name: string;
  url: string;
}): EmailMessage {
  return actionEmail({
    to: params.to,
    subject: "Restablecé tu contraseña",
    greetingName: params.name,
    intro: "Recibimos un pedido para restablecer tu contraseña.",
    actionLabel: "Elegir una nueva contraseña",
    url: params.url,
    outro:
      "El enlace vence en 1 hora. Si no lo pediste, podés ignorar este mensaje.",
  });
}
