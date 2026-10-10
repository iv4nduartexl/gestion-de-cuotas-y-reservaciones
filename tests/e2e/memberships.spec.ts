import { expect, test, type Page } from "@playwright/test";

import { sidebar, USERS } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ storageState: USERS.e.storageState });

/** Picks day 10 of the month `monthsBack` months ago in the open Spanish calendar. */
async function pickDay10(page: Page, label: string, monthsBack: number) {
  await page.getByLabel(label).click();
  for (let i = 0; i < monthsBack; i++) await page.getByRole("button", { name: "Ir al mes anterior" }).click();
  await page.getByRole("button", { name: /(^|, )10 de / }).click();
}

let chargeUrl = "";

test("a gym starts by creating a plan", async ({ page }) => {
  await page.goto("/dashboard/cuotas");
  await expect(page.getByText("Primero creá un plan")).toBeVisible();
  await page.getByRole("link", { name: "Crear mi primer plan" }).click();

  await page.getByLabel("Nombre", { exact: true }).fill("Musculación");
  const price = page.getByLabel("Precio");
  await price.pressSequentially("150000");
  await expect(price).toHaveValue("150.000");
  await expect(page.getByLabel("Frecuencia")).toHaveValue("month-1");
  await page.getByRole("button", { name: "Crear plan" }).click();

  await expect(page).toHaveURL(/\/dashboard\/planes$/);
  await expect(page.getByText("Plan creado")).toBeVisible();
  const card = page.getByRole("link", { name: /Musculación/ });
  await expect(card).toContainText("150.000");
  await expect(card).toContainText("por mes");
});

test("enrolling a socio two months back generates overdue cuotas", async ({ page }) => {
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Nombre y apellido").fill("Socio Uno");
  await page.getByLabel("Teléfono / WhatsApp").fill("0981 500 001");
  await page.getByRole("button", { name: "Guardar socio" }).click();
  await expect(page.getByRole("heading", { name: "Socio Uno" })).toBeVisible();

  await page.getByRole("button", { name: "Inscribir en un plan" }).click();
  await pickDay10(page, "Desde", 2);
  await expect(page.getByText("se van a generar las cuotas de los períodos que ya pasaron")).toBeVisible();
  await page.getByRole("button", { name: "Inscribir", exact: true }).click();
  await expect(page.getByText("Inscripción creada")).toBeVisible();

  const membership = page.locator("section").filter({ has: page.getByRole("heading", { name: "Membresía" }) });
  await expect(membership.getByText("Activa")).toBeVisible();
  await expect(membership.getByText(/Vencido · debe/)).toBeVisible();
  expect(await membership.getByText("Vencida", { exact: true }).count()).toBeGreaterThanOrEqual(2);
});

test("partial then full payment, with live summary and WhatsApp reminder", async ({ page }) => {
  await page.goto("/dashboard/cuotas");
  // Overdue cuotas exist, so the list opens on "Vencidas".
  await expect(page.getByRole("link", { name: "Vencidas" })).toHaveAttribute("aria-current", "true");
  const row = page.getByRole("listitem").filter({ hasText: "Socio Uno" }).first();
  await expect(row).toContainText("Vencida");

  const reminder = row.getByRole("link", { name: /Recordar a Socio Uno/ });
  await expect(reminder).toHaveAttribute("href", /^https:\/\/wa\.me\/595981500001\?text=.*150\.000/);

  await row.getByRole("button", { name: "Registrar pago" }).click();
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Monto recibido");
  await expect(amount).toHaveValue("150.000");
  await amount.fill("50000");
  await expect(amount).toHaveValue("50.000");
  await dialog.getByRole("button", { name: "Transferencia" }).click();
  await dialog.getByRole("button", { name: "Guardar pago" }).click();
  await expect(page.getByText(/Pago registrado\. Falta Gs\.\s100\.000/)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("pagó");

  await row.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByRole("dialog").getByLabel("Monto recibido")).toHaveValue("100.000");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar pago" }).click();
  await expect(page.getByText("Pago registrado: cuota al día")).toBeVisible();

  await page.getByRole("link", { name: "Pagadas" }).click();
  const paid = page.getByRole("listitem").filter({ hasText: "Socio Uno" }).first();
  await expect(paid).toContainText("Pagada");
  await expect(page.getByText(/Cobrado este mes/).locator("..")).toContainText("150.000");

  await paid.getByRole("link", { name: /Ver cuota de Socio Uno/ }).click();
  await expect(page.getByRole("heading", { name: "Cuota de Socio Uno" })).toBeVisible();
  // Two payments (the dialog keeps the last method chosen): 50.000 + 100.000.
  const paymentsList = page.getByRole("listitem").filter({ hasText: "Transferencia" }).filter({ visible: true });
  await expect(paymentsList).toHaveCount(2);
  await expect(paymentsList.nth(0)).toContainText("50.000");
  await expect(paymentsList.nth(1)).toContainText("100.000");
  chargeUrl = page.url();
});

test("pause and cancel a membership", async ({ page }) => {
  await page.goto("/dashboard/clients");
  await page.getByRole("link", { name: "Socio Uno" }).first().click();
  const membership = page.locator("section").filter({ has: page.getByRole("heading", { name: "Membresía" }) });

  await membership.getByRole("button", { name: "Pausar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pausar" }).click();
  await expect(membership.getByText("Pausada", { exact: true })).toBeVisible();

  await membership.getByRole("button", { name: "Dar de baja" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dar de baja" }).click();
  await expect(membership.getByText("Cancelada", { exact: true })).toBeVisible();
});

test("another business can't open the cuota", async ({ browser }) => {
  const context = await browser.newContext({ storageState: USERS.a.storageState });
  const page = await context.newPage();
  await page.goto(chargeUrl);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await context.close();
});

test("gym navigation: Cuotas and Planes, also on phones", async ({ page, browser }) => {
  await page.goto("/dashboard");
  await expect(sidebar(page).getByRole("link", { name: "Cuotas" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Planes" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Agenda", exact: true })).toHaveCount(0);

  const phone = await browser.newContext({ storageState: USERS.e.storageState, viewport: { width: 390, height: 844 }, hasTouch: true });
  const mobile = await phone.newPage();
  await mobile.goto("/dashboard");
  const tabs = mobile.getByRole("navigation", { name: "Navegación principal" });
  await tabs.getByRole("link", { name: "Cuotas" }).click();
  await expect(mobile.getByRole("heading", { name: "Cuotas", level: 1 })).toBeVisible();
  await phone.close();
});
