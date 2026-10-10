import { expect, test } from "@playwright/test";

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
