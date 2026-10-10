import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.a.storageState });

test("the owner is on the team after onboarding (team mode)", async ({ page }) => {
  await page.goto("/dashboard/staff");
  await expect(page.getByRole("link", { name: new RegExp(USERS.a.name) })).toBeVisible();
});

test("weekly schedule: preset, persistence, overlap error", async ({ page }) => {
  await page.goto("/dashboard/schedule");
  await expect(page.getByRole("heading", { name: `Horario de ${USERS.a.name}` })).toBeVisible();

  await page.getByRole("button", { name: "Lun a vie · 08–12 y 14–18" }).click();
  await expect(page.getByTestId("weekday-5").getByLabel("Viernes: desde")).toHaveCount(2);
  await expect(page.getByTestId("weekday-6").getByText("No se toman turnos este día.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado")).toBeVisible();

  // Persisted after reload, in 24 h format.
  await page.reload();
  await expect(page.getByTestId("weekday-3").getByLabel("Miércoles: desde").nth(1)).toHaveValue("14:00");
  await expect(page.getByTestId("weekday-7").getByText("Cerrado")).toBeVisible();

  // Overlap: Monday 08:00–12:00 and 11:00–18:00.
  const monday = page.getByTestId("weekday-1");
  await monday.getByLabel("Lunes: desde").nth(1).selectOption("11:00");
  await expect(monday.getByText("Estas franjas se superponen.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Hay franjas horarias que se superponen.")).toBeVisible();
});

test("create a service with live guaraní formatting", async ({ page }) => {
  await page.goto("/dashboard/services/new");
  await page.getByLabel("Nombre", { exact: true }).fill("Corte clásico");
  await page.getByLabel("Duración").selectOption("45");
  const price = page.getByLabel("Precio");
  await price.pressSequentially("1250000");
  await expect(price).toHaveValue("1.250.000");
  await expect(page.getByRole("checkbox", { name: USERS.a.name })).toBeChecked();
  await page.getByRole("button", { name: "Guardar servicio" }).click();

  await expect(page).toHaveURL(/\/dashboard\/services$/);
  await expect(page.getByText("Servicio creado")).toBeVisible();
  const card = page.getByRole("link", { name: /Corte clásico/ });
  await expect(card).toContainText("45 min");
  await expect(card).toContainText("1.250.000");
  await expect(card).toContainText(`1 profesional`);
});

test("days off: business-wide block with the calendar, and national holidays", async ({ page }) => {
  await page.goto("/dashboard/schedule?tab=dias-libres");
  await page.getByLabel("¿Para quién?").selectOption({ label: "Todo el negocio (ej.: feriado)" });

  // Pick the 15th of next month with the Spanish calendar.
  await page.getByLabel("Desde").click();
  await page.getByRole("button", { name: "Ir al mes siguiente" }).click();
  await page.getByRole("button", { name: / 15 de / }).click();
  await expect(page.getByLabel("Desde")).toContainText("15/");
  await expect(page.getByLabel("Hasta")).toContainText("15/");

  await page.getByLabel(/Motivo/).fill("Cierre por inventario");
  await page.getByRole("button", { name: "Agregar día libre" }).click();
  await expect(page.getByText("Día libre agregado")).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: "Cierre por inventario" });
  await expect(item).toContainText("todo el día");
  await expect(item).toContainText("Todo el negocio");

  await page.getByRole("button", { name: "Agregar feriados nacionales" }).click();
  await expect(page.getByText(/Agregamos \d+ feriado/)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Feriado: Navidad" })).toBeVisible();
});

test("dashboard guide reflects progress", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Definí tu horario de atención")).toHaveClass(/line-through/);
  await expect(page.getByText("Cargá tus servicios")).toHaveClass(/line-through/);
});
