// Maps Better Auth error codes to Spanish messages for the UI.
const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED:
    "Tenés que verificar tu correo. Te enviamos un nuevo enlace de verificación.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  INVALID_EMAIL: "El correo no es válido.",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_PASSWORD: "La contraseña no es válida.",
  INVALID_TOKEN: "El enlace no es válido o ya fue usado.",
  TOKEN_EXPIRED: "El enlace venció. Pedí uno nuevo.",
  USER_NOT_FOUND: "No encontramos la cuenta.",
  EMAIL_ALREADY_VERIFIED: "Tu correo ya está verificado.",
};

export function authErrorMessage(
  error: { code?: string; status?: number } | null | undefined,
) {
  if (error?.status === 429) {
    return "Demasiados intentos. Esperá un momento y volvé a intentar.";
  }
  return (
    (error?.code && messages[error.code]) ||
    "Ocurrió un error. Intentá de nuevo."
  );
}
