import { expect, test } from "@playwright/test";

import { PASSWORD, sidebar, signIn, USERS } from "./helpers";

test("unauthenticated users are sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard/clients");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%2Fclients/);
});

test("wrong password shows a Spanish error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Correo electrónico").fill("ana@e2e.test");
  await page.getByLabel("Contraseña").fill("incorrecta123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});

test("signing in again after signing out works (the button isn't stuck)", async ({ page }) => {
  await signIn(page, USERS.d);
  await expect(page).toHaveURL(/\/dashboard/);
  await sidebar(page).getByRole("button", { name: new RegExp(USERS.d.email) }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  // Same page instance (no reload): the bug was a button left on "Ingresando…".
  const submit = page.getByRole("button", { name: "Ingresar" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Correo electrónico").fill(USERS.d.email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
});
