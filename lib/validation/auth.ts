import { z } from "zod";

// Client-side form validation. Better Auth re-validates on the server.
const email = z.email("Ingresá un correo válido.").trim().toLowerCase();
const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128, "La contraseña es demasiado larga.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá tu nombre.").max(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });
