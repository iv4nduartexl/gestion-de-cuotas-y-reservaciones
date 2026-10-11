import { expect, test } from "@playwright/test";

import { USERS, expectTime, setTime, timePicker, wizardNext } from "./helpers";

test.use({ storageState: USERS.a.storageState });

test("the owner is on the team after onboarding (team mode)", async ({ page }) => {
  await page.goto("/dashboard/staff");
  await expect(page.getByRole("link", { name: new RegExp(USERS.a.name) })).toBeVisible();
});

test("weekly schedule with the step-by-step assistant, then day by day", async ({ page }) => {
  await page.goto("/dashboard/schedule");
  // No hours yet: the assistant starts right away.
  await expect(page.getByRole("heading", { name: `¿Qué días atiende ${USERS.a.name}?` })).toBeVisible();
  // Nonsense is blocked, with a fix.
  await page.getByRole("button", { name: "Lunes a viernes" }).click();
  await wizardNext(page);
  await setTime(timePicker(page, "Abro a las"), "18:00");
  await setTime(timePicker(page, "Cierro a las"), "08:00");
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByRole("button", { name: "De 08:00 a 18:00" }).click();
  await wizardNext(page);
  await page.getByRole("radio", { name: /Sí, hago un corte/ }).click();
  await wizardNext(page);
  await wizardNext(page);
  await expect(page.getByText("Lunes a viernes de 08:00 a 12:00 y de 14:00 a 18:00")).toBeVisible();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado").first()).toBeVisible();

  // Saved: a plain summary.
  await expect(page.getByText("Lunes a viernes de 08:00 a 12:00 y de 14:00 a 18:00")).toBeVisible();

  // Power users can still edit day by day; overlaps are refused.
  await page.getByRole("link", { name: "Editar día por día" }).click();
  await expectTime(timePicker(page.getByTestId("weekday-3"), "Miércoles: desde", 1), "14:00");
  const monday = page.getByTestId("weekday-1");
  await setTime(timePicker(monday, "Lunes: desde", 1), "11:00");
  await expect(monday.getByText("Estas franjas se superponen.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText(/se pisan|se superponen/).first()).toBeVisible();
});

test("create a service with the assistant and live guaraní formatting", async ({ page }) => {
  await page.goto("/dashboard/services/new");
  await wizardNext(page);
  await page.getByLabel("Nombre", { exact: true }).fill("Corte clásico");
  await wizardNext(page);
  // Longer than the 10 h day: blocked, and the fix sets one that fits.
  await page.getByRole("radio", { name: "12 h" }).click();
  await expect(page.getByText(/nadie podría reservarlo/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByLabel("Horas").fill("0");
  await page.getByLabel("Minutos").fill("45");
  await wizardNext(page);
  const price = page.getByLabel("Precio");
  await price.pressSequentially("1250000");
  await expect(price).toHaveValue("1.250.000");
  await wizardNext(page);
  await expect(page.getByRole("checkbox", { name: USERS.a.name })).toBeChecked();
  await wizardNext(page);
  await expect(page.getByText("Así lo ven tus clientes:")).toBeVisible();
  await page.getByRole("button", { name: "Crear servicio" }).click();

  await expect(page).toHaveURL(/\/dashboard\/services$/);
  await expect(page.getByText("Servicio creado")).toBeVisible();
  const card = page.getByRole("link", { name: /Corte clásico/ });
  await expect(card).toContainText("45 min");
  await expect(card).toContainText("1.250.000");
  await expect(card).toContainText(`1 profesional`);

  // Editing one setting from the summary.
  await card.click();
  await page.getByRole("link", { name: "Cambiar precio" }).click();
  await expect(page.getByRole("heading", { name: "¿Cuánto cuesta?" })).toBeVisible();
  const newPrice = page.getByLabel("Precio", { exact: true });
  await newPrice.fill("");
  await newPrice.pressSequentially("90000");
  await page.getByRole("button", { name: "Guardar cambio" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(page.getByText("Gs. 90.000").first()).toBeVisible();
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
