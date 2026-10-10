import { expect, test } from "@playwright/test";

import { sidebar, USERS } from "./helpers";

test.use({ storageState: USERS.b.storageState });

test("create a second business and switch between them", async ({ page }) => {
  await page.goto("/dashboard");

  await sidebar(page).getByRole("button", { name: new RegExp(USERS.b.business) }).click();
  await page.getByRole("menuitem", { name: "Agregar negocio" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: /Otro rubro/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre del negocio").fill("Academia Gamma");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Crear mi negocio" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(sidebar(page).getByRole("button", { name: /Academia Gamma/ })).toBeVisible();
  // "Otro rubro" with turnos: appointment sections appear, solo mode hides "Equipo".
  await expect(sidebar(page).getByRole("link", { name: "Horarios" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Equipo" })).toHaveCount(0);

  // Switch back.
  await sidebar(page).getByRole("button", { name: /Academia Gamma/ }).click();
  await page.getByRole("menuitem", { name: new RegExp(USERS.b.business) }).click();
  await expect(sidebar(page).getByRole("button", { name: new RegExp(USERS.b.business) })).toBeVisible();
});

test("sign out", async ({ browser }) => {
  // Separate session so the shared storage state stays signed in.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Correo electrónico").fill(USERS.b.email);
  await page.getByLabel("Contraseña").fill("supersecreta1");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await sidebar(page).getByRole("button", { name: new RegExp(USERS.b.email) }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await context.close();
});
