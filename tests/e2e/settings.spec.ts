import { expect, test } from "@playwright/test";

import { sidebar, USERS } from "./helpers";

test.use({ storageState: USERS.c.storageState });

test("settings: switching to team mode shows the team section", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Configuración", level: 1 })).toBeVisible();
  // A gym has no appointments yet, so there is no team-mode section.
  await expect(page.getByRole("heading", { name: "Forma de trabajo" })).toHaveCount(0);

  const usageForm = page.locator("form").filter({ has: page.getByRole("switch", { name: "Turnos online" }) });
  await usageForm.getByRole("switch", { name: "Turnos online" }).click();
  await usageForm.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Horarios" })).toBeVisible();

  const teamForm = page.locator("form").filter({ has: page.getByRole("radio", { name: /Somos un equipo/ }) });
  await teamForm.getByRole("radio", { name: /Somos un equipo/ }).click();
  await teamForm.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Modo equipo activado.")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Equipo" })).toBeVisible();
});
