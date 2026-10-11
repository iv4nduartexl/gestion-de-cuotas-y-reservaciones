import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

import { asuncionDate, sidebar, USERS } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ storageState: USERS.f.storageState });

const HOUR = 3_600_000;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Seeds a turno `hoursAhead` from now for a new client (optionally with email). */
async function seedTurno(name: string, phone: string, email: string | null, hoursAhead: number) {
  const [{ organization_id: org }] = await sql<{ organization_id: string }>("select organization_id from business_settings where slug = $1", [USERS.f.slug]);
  const [{ id: staffId }] = await sql<{ id: string }>("select id from staff where organization_id = $1 and archived_at is null limit 1", [org]);
  let [service] = await sql<{ id: string }>("select id from services where organization_id = $1 and name = 'Corte e2e'", [org]);
  if (!service) {
    [service] = await sql<{ id: string }>(
      "insert into services (organization_id, name, duration_minutes, price, currency) values ($1, 'Corte e2e', 30, 50000, 'PYG') returning id",
      [org],
    );
    await sql("insert into service_staff (organization_id, service_id, staff_id) values ($1, $2, $3)", [org, service.id, staffId]);
  }
  const [client] = await sql<{ id: string }>(
    "insert into clients (organization_id, name, phone, email) values ($1, $2, $3, $4) returning id",
    [org, name, phone, email],
  );
  const start = new Date(Math.ceil((Date.now() + hoursAhead * HOUR) / (30 * 60_000)) * 30 * 60_000);
  await sql(
    `insert into appointments (organization_id, client_id, service_id, staff_id, starts_at, ends_at, source, price, currency)
     values ($1, $2, $3, $4, $5, $6, 'dashboard', 50000, 'PYG')`,
    [org, client.id, service.id, staffId, start, new Date(start.getTime() + 30 * 60_000)],
  );
  return { org, clientId: client.id };
}

async function runCron(page: Page) {
  const response = await page.request.post("/api/cron/run", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(response.status()).toBe(200);
  return response.json();
}

test("the job endpoint requires the secret", async ({ request }) => {
  expect((await request.post("/api/cron/run")).status()).toBe(401);
  expect((await request.post("/api/cron/run", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await request.post("/api/payments/webhook/fake", { data: "{}" })).status()).toBe(401);
});

test("the job plans reminders: email ones go out, WhatsApp ones wait in the tray", async ({ page }) => {
  // Fake WhatsApp so tapping "Enviar" doesn't leave the test environment.
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));

  const { org } = await seedTurno("Rita Recordatorio", "+595981600001", null, 20);
  await seedTurno("Emma Correo", "+595981600002", "emma@e2e.test", 21);
  // A cuota due in 3 days for a socio without email.
  const [plan] = await sql<{ id: string }>(
    "insert into plans (organization_id, name, price, currency, interval_unit) values ($1, 'Pilates', 120000, 'PYG', 'month') returning id",
    [org],
  );
  const [socio] = await sql<{ id: string }>("insert into clients (organization_id, name, phone) values ($1, 'Sole Cuota', '+595981600003') returning id", [org]);
  const due = asuncionDate(new Date(Date.now() + 3 * 24 * HOUR).toISOString());
  await sql(
    "insert into enrollments (organization_id, client_id, plan_id, start_date, bill_from, price, currency) values ($1, $2, $3, $4, $4, 120000, 'PYG')",
    [org, socio.id, plan.id, due],
  );

  const report = await runCron(page);
  expect(report.ran).toBe(true);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Recordatorios de hoy" })).toBeVisible();
  await expect(page.getByText("2 por enviar")).toBeVisible();

  await sidebar(page).getByRole("link", { name: "Recordatorios" }).click();
  await expect(page).toHaveURL(/\/dashboard\/recordatorios$/);
  const turno = page.getByRole("listitem").filter({ hasText: "Rita Recordatorio" });
  await expect(turno).toContainText("Turno mañana");
  const send = turno.getByRole("link", { name: "Enviar recordatorio a Rita Recordatorio por WhatsApp" });
  await expect(send).toHaveAttribute("href", /^https:\/\/wa\.me\/595981600001\?text=Hola%20Rita.*Corte%20e2e.*Estudio%20Foxtrot/);

  const cuota = page.getByRole("listitem").filter({ hasText: "Sole Cuota" });
  await expect(cuota).toContainText("Cuota por vencer");
  await expect(cuota.getByRole("link", { name: /Enviar recordatorio/ })).toHaveAttribute("href", /wa\.me\/595981600003\?text=.*120\.000/);
  // The client with email never shows up here.
  await expect(page.getByRole("listitem").filter({ hasText: "Emma Correo" })).toHaveCount(0);

  // Sending opens WhatsApp and marks it done, with undo.
  const popup = page.waitForEvent("popup");
  await send.click();
  await (await popup).close();
  await expect(page.getByText("Recordatorio a Rita marcado como enviado")).toBeVisible();
  await expect(turno).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(turno).toBeVisible();

  await page.getByRole("button", { name: "Marcar todos como enviados" }).click();
  await expect(page.getByText("2 recordatorios marcados como enviados")).toBeVisible();
  await expect(page.getByText("¡Todo al día!")).toBeVisible();

  await page.getByRole("link", { name: "Historial" }).click();
  const emma = page.getByRole("listitem").filter({ hasText: "Emma Correo" });
  await expect(emma).toContainText("Enviado por correo");
  await expect(page.getByRole("listitem").filter({ hasText: "Rita Recordatorio" })).toContainText("Enviado por WhatsApp");
});

test("settings decide what gets planned", async ({ page }) => {
  await page.goto("/dashboard/settings?seccion=recordatorios&editar=recordatorios");
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Recordatorios", exact: true }) });
  const dayBefore = section.getByRole("switch", { name: "Recordar el día anterior" });
  await expect(dayBefore).toBeChecked();
  await dayBefore.click();
  await section.getByLabel("Mensaje de WhatsApp para turnos").fill("Hola {nombre}, nos vemos el {dia} a las {hora}.");
  await expect(section.getByText(/Hola María, nos vemos el lunes 12\/10 a las 10:00\./)).toBeVisible();
  await section.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Recordatorios guardados")).toBeVisible();

  await seedTurno("Nico Sinaviso", "+595981600004", null, 22);
  await runCron(page);
  await page.goto("/dashboard/recordatorios");
  await expect(page.getByText("¡Todo al día!")).toBeVisible();
  await expect(page.getByText("Nico Sinaviso")).toHaveCount(0);

  // Back on: the next run plans it, with the custom text.
  await page.goto("/dashboard/settings?seccion=recordatorios&editar=recordatorios");
  await section.getByRole("switch", { name: "Recordar el día anterior" }).click();
  await section.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Recordatorios guardados")).toBeVisible();
  await runCron(page);
  await page.goto("/dashboard/recordatorios");
  await expect(page.getByRole("link", { name: /Enviar recordatorio a Nico Sinaviso/ })).toHaveAttribute("href", /text=Hola%20Nico%2C%20nos%20vemos%20el/);
});
