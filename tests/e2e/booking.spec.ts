import { expect, test, type Browser, type Page } from "@playwright/test";

import { USERS, asuncionDate, createSlotService, setTime, timePicker } from "./helpers";

// One business, set up step by step: the tests depend on each other.
test.describe.configure({ mode: "serial" });

const OWNER = USERS.d;
const PUBLIC = `/${OWNER.slug}`;
const PHONE_VIEWPORT = { viewport: { width: 390, height: 844 }, hasTouch: true };

async function ownerPage(browser: Browser) {
  const context = await browser.newContext({ storageState: OWNER.storageState });
  return { context, page: await context.newPage() };
}

async function clientPage(browser: Browser) {
  const context = await browser.newContext(PHONE_VIEWPORT);
  return { context, page: await context.newPage() };
}

/** Walks the public flow up to the details step; returns the chosen start (ISO). */
async function pickFirstSlot(page: Page) {
  await page.goto(PUBLIC);
  await page.getByRole("button", { name: /Corte/ }).click();
  await expect(page.getByRole("heading", { name: /Elegí día y hora/ })).toBeVisible();
  const slot = page.locator("button[aria-pressed]").first();
  await slot.click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: /Tus datos/ })).toBeVisible();
  return page.locator('input[name="start"]').inputValue();
}

async function fillDetails(page: Page, name: string, phone: string) {
  await page.getByLabel("Nombre y apellido").fill(name);
  await page.getByLabel("Teléfono / WhatsApp").fill(phone);
}

let bookedUrl = "";
let bookedStart = "";
let bookedTime = "";

test("before setup, the public page explains it isn't ready", async ({ browser }) => {
  const { context, page } = await clientPage(browser);
  await page.goto(PUBLIC);
  await expect(page.getByRole("heading", { name: OWNER.business })).toBeVisible();
  await expect(page.getByText("Todavía no hay turnos disponibles")).toBeVisible();
  await context.close();
});

test("owner sets hours, a service and public data", async ({ browser }) => {
  const { context, page } = await ownerPage(browser);
  await page.goto("/dashboard");
  await expect(page.getByText("Falta configurar", { exact: true })).toBeVisible();

  await page.goto("/dashboard/schedule?modo=detalle");
  for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
    const day = page.getByTestId(`weekday-${weekday}`);
    if ((await day.getByText("Cerrado").count()) > 0) await day.getByRole("switch").click();
  }
  // Every day 06:00–23:00 so there are slots whenever the suite runs.
  for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
    const day = page.getByTestId(`weekday-${weekday}`);
    await day.getByRole("button", { name: /Quitar franja/ }).last().click();
    await setTime(timePicker(day, /: desde$/), "06:00");
    await setTime(timePicker(day, /: hasta$/), "23:00");
  }
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado")).toBeVisible();

  await createSlotService(page, { name: "Corte", minutes: 30, price: "50000" });
  await expect(page.getByText("Servicio creado")).toBeVisible();

  // Settings show a summary; "Cambiar" opens just that part.
  await page.goto("/dashboard/settings?seccion=reservas");
  await page.getByRole("link", { name: "Cambiar whatsapp y dirección" }).click();
  await page.getByLabel(/WhatsApp del negocio/).fill("0991 222 333");
  await page.getByLabel(/Dirección/).fill("Av. España 123, Asunción");
  await page.getByRole("button", { name: "Guardar datos públicos" }).click();
  await expect(page.getByText("Datos públicos guardados")).toBeVisible();

  // Let clients cancel up to the start, so the test doesn't depend on the time of day.
  await page.goto("/dashboard/settings?seccion=reservas&editar=reglas");
  await page.getByLabel("Cancelación online").selectOption("0");
  await page.getByRole("button", { name: "Guardar reglas" }).click();
  await expect(page.getByText("Reglas de reserva guardadas")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Activo", { exact: true })).toBeVisible();
  await context.close();
});

test("a client books on a phone and gets a private link", async ({ browser }) => {
  const { context, page } = await clientPage(browser);
  bookedStart = await pickFirstSlot(page);
  await fillDetails(page, "Cliente Web", "0981 400 001");
  await page.getByRole("button", { name: "Confirmar turno" }).click();

  await expect(page).toHaveURL(/\/turno\//);
  await expect(page.getByRole("heading", { name: "¡Turno confirmado!" })).toBeVisible();
  await expect(page.getByText("Gs. 50.000").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Av. España 123, Asunción").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Agregar al calendario" })).toHaveAttribute("href", /calendar\.ics$/);
  bookedUrl = page.url();
  bookedTime = (await page.getByText(/^\d{2}:\d{2} a \d{2}:\d{2}$/).filter({ visible: true }).first().textContent())!.slice(0, 5);

  // The ICS download works.
  const ics = await page.request.get(`${bookedUrl}/calendar.ics`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("SUMMARY:Corte\\, Barbería Delta");
  await context.close();
});

test("the booked slot is no longer offered", async ({ browser }) => {
  const { context, page } = await clientPage(browser);
  await page.goto(PUBLIC);
  await page.getByRole("button", { name: /Corte/ }).click();
  await page.locator(`[data-date="${asuncionDate(bookedStart)}"]`).click();
  await expect(page.locator("button[aria-pressed]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: bookedTime, exact: true })).toHaveCount(0);
  await context.close();
});

test("the business sees it in the Agenda", async ({ browser }) => {
  const { context, page } = await ownerPage(browser);
  await page.goto(`/dashboard/agenda?fecha=${asuncionDate(bookedStart)}`);
  const item = page.getByRole("link", { name: /Cliente Web/ });
  await expect(item).toBeVisible();
  await expect(item).toContainText("Confirmado");
  await expect(item).toContainText("Online");
  await item.click();
  await expect(page.getByRole("heading", { name: "Turno de Cliente Web" })).toBeVisible();
  await expect(page.getByText("Reservado online por el cliente")).toBeVisible();
  await context.close();
});

test("the client cancels from the private link", async ({ browser }) => {
  const { context, page } = await clientPage(browser);
  await page.goto(bookedUrl);
  await page.getByRole("button", { name: "Cancelar turno" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Turno cancelado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar turno" })).toHaveCount(0);
  await context.close();
});

test("two clients race for the same slot: one gets it, the other is told", async ({ browser }) => {
  const first = await clientPage(browser);
  const second = await clientPage(browser);
  const startA = await pickFirstSlot(first.page);
  const startB = await pickFirstSlot(second.page);
  expect(startA).toBe(startB);

  await fillDetails(first.page, "Primera Persona", "0981 400 010");
  await fillDetails(second.page, "Segunda Persona", "0981 400 011");
  await first.page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(first.page.getByRole("heading", { name: "¡Turno confirmado!" })).toBeVisible();

  await second.page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(second.page.getByText("Ese horario se acaba de ocupar")).toBeVisible();
  await expect(second.page.getByRole("heading", { name: /Elegí día y hora/ })).toBeVisible();
  await first.context.close();
  await second.context.close();
});

test("manual confirmation: bookings arrive pending and the owner confirms", async ({ browser }) => {
  const owner = await ownerPage(browser);
  await owner.page.goto("/dashboard/settings?seccion=reservas&editar=reglas");
  const rules = owner.page.locator("form").filter({ has: owner.page.getByRole("switch", { name: "Confirmar turnos automáticamente" }) });
  await rules.getByRole("switch", { name: "Confirmar turnos automáticamente" }).click();
  await rules.getByRole("button", { name: "Guardar reglas" }).click();
  await expect(owner.page.getByText("Reglas de reserva guardadas")).toBeVisible();

  const client = await clientPage(browser);
  const start = await pickFirstSlot(client.page);
  await fillDetails(client.page, "Cliente Pendiente", "0981 400 020");
  await client.page.getByRole("button", { name: "Solicitar turno" }).click();
  await expect(client.page.getByRole("heading", { name: "Turno solicitado" })).toBeVisible();
  await client.context.close();

  await owner.page.goto(`/dashboard/agenda?fecha=${asuncionDate(start)}`);
  await expect(owner.page.getByText(/espera tu confirmación|esperan tu confirmación/)).toBeVisible();
  await owner.page.getByRole("link", { name: /Cliente Pendiente/ }).click();
  await owner.page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(owner.page.getByText("Turno confirmado")).toBeVisible();
  await expect(owner.page.getByRole("button", { name: /Vino/ })).toBeVisible();
  await owner.context.close();
});

test("the owner books a walk-in from the dashboard", async ({ browser }) => {
  const { context, page } = await ownerPage(browser);
  await page.goto("/dashboard/agenda/new");
  await page.getByRole("button", { name: /Nuevo cliente/ }).click();
  await page.getByLabel("Nombre y apellido").fill("Cliente Mostrador");
  await page.getByLabel("Teléfono / WhatsApp").fill("0981 400 030");
  const slot = page.locator("button[aria-pressed]").first();
  if ((await slot.count()) === 0) {
    // Late at night: book tomorrow.
    await page.getByLabel("Día").click();
    await page.getByRole("button", { name: /Ir al mes siguiente/ }).click();
    await page.getByRole("button", { name: / 15 de / }).click();
  }
  await page.locator("button[aria-pressed]").first().click();
  await page.getByRole("button", { name: "Agendar turno" }).click();
  await expect(page.getByRole("heading", { name: "Turno de Cliente Mostrador" })).toBeVisible();
  await expect(page.getByText("Agendado desde el panel")).toBeVisible();
  await expect(page.getByText("Turno agendado")).toBeVisible();

  // Another business can't open it.
  const turnoUrl = page.url().replace(/\?.*$/, "");
  const other = await browser.newContext({ storageState: USERS.a.storageState });
  const otherPage = await other.newPage();
  await otherPage.goto(turnoUrl);
  await expect(otherPage.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await other.close();
  await context.close();
});
