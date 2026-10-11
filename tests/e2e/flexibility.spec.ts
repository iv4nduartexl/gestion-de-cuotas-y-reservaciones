import { expect, test } from "@playwright/test";

import { USERS, asuncionDate, expectTime, pickCalendarDate, setTime, timePicker, wizardNext } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ storageState: USERS.h.storageState });

const plusDays = (n: number) => asuncionDate(new Date(Date.now() + n * 86_400_000).toISOString());

test("schedule hours with the clock picker and the keyboard", async ({ page }) => {
  await page.goto("/dashboard/schedule?modo=detalle");
  // Every day 08–12 and 14–19, typed like a keyboard user.
  for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
    const day = page.getByTestId(`weekday-${weekday}`);
    if ((await day.getByText("Cerrado").count()) > 0) await day.getByRole("switch").click();
  }
  // New days come with 08–12 and 14–18: stretch the afternoon to 19:00.
  const monday = page.getByTestId("weekday-1");
  // Typing two-digit numbers over an existing value (the box showed 18:00).
  const until = timePicker(monday, "Lunes: hasta", 1);
  await until.getByLabel(/: hora$/).click();
  await page.keyboard.type("21");
  await page.keyboard.type("15");
  await expectTime(until, "21:15");
  await setTime(until, "19:00");

  // The clock: open it, move the hour with the keyboard, confirm.
  const from = timePicker(monday, "Lunes: desde");
  await from.getByRole("button", { name: /reloj/ }).click();
  const dial = page.getByRole("slider", { name: "Hora" });
  await expect(dial).toBeVisible();
  await dial.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter"); // → minutes
  await page.getByRole("button", { name: "Listo" }).click();
  await expectTime(from, "09:00");
  await setTime(from, "08:00");

  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado")).toBeVisible();
});

test("a rental: nonsense hours are blocked, then it's booked by dates and priced by the week", async ({ page }) => {
  await page.goto("/dashboard/services/new");
  await page.getByRole("radio", { name: /Por días/ }).click();
  await wizardNext(page);
  await page.getByLabel("Nombre", { exact: true }).fill("Casa de campo");
  await wizardNext(page);
  // Per day, exit before entry makes no sense: blocked with fixes.
  await page.getByRole("radio", { name: /Por día/ }).click();
  await wizardNext(page);
  await setTime(timePicker(page, "Hora de entrada"), "14:00");
  await setTime(timePicker(page, "Hora de salida"), "10:00");
  await expect(page.getByRole("alert").filter({ hasText: "la salida tiene que ser después de la entrada el mismo día" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByRole("button", { name: "Cobrar por noche" }).click();
  await wizardNext(page);
  await page.getByLabel("Mínimo de noches").fill("2");
  await wizardNext(page);
  await page.getByLabel("Precio por noche").pressSequentially("300000");
  await page.getByText("¿Hacés precio especial por semana o por mes?").click();
  // A weekly price above 7 nights is refused.
  await page.getByLabel("Por semana").pressSequentially("2500000");
  await expect(page.getByText(/sale más caro que 7 noches sueltas/)).toBeVisible();
  await page.getByLabel("Por semana").fill("");
  await page.getByLabel("Por semana").pressSequentially("1800000");
  await wizardNext(page);
  await expect(page.getByText(/7 noches: Gs\.\s1\.800\.000/)).toBeVisible();
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("Servicio creado")).toBeVisible();
  await expect(page.getByRole("link", { name: /Casa de campo/ })).toContainText("por noche");

  // With only rentals, "Nuevo turno" goes straight to the rental form.
  await page.goto("/dashboard/agenda/new");
  await expect(page.getByRole("heading", { name: "Nuevo alquiler", level: 1 })).toBeVisible();

  const checkIn = plusDays(20);
  const checkOut = plusDays(27);
  await page.goto(`/${USERS.h.slug}`);
  await page.getByRole("button", { name: /Casa de campo/ }).click();
  await expect(page.getByRole("heading", { name: "Elegí las fechas" })).toBeVisible();
  // Two calendars, one tap each.
  await pickCalendarDate(page.getByRole("region", { name: /¿Qué día llegás\?/ }), checkIn);
  await pickCalendarDate(page.getByRole("region", { name: /¿Qué día te vas\?/ }), checkOut);
  await expect(page.getByText(/7 noches · Gs\.\s1\.800\.000/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre y apellido").fill("Laura Huésped");
  await page.getByLabel("Teléfono / WhatsApp").fill("0981 900 001");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByRole("heading", { name: "¡Reserva confirmada!" })).toBeVisible();
  await expect(page.getByText(/Entrada 14:00 · salida 10:00/)).toBeVisible();

  // Those nights are taken now.
  await page.goto(`/${USERS.h.slug}`);
  await page.getByRole("button", { name: /Casa de campo/ }).click();
  const [y, m, d] = plusDays(22).split("-").map(Number);
  const month = new Intl.DateTimeFormat("es-PY", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const arrival = page.getByRole("region", { name: /¿Qué día llegás\?/ });
  const night = arrival.getByRole("button", { name: new RegExp(`(^|, )${d} de ${month} de ${y}`) });
  for (let i = 0; i < 3 && (await night.count()) === 0; i++) await arrival.getByRole("button", { name: /mes siguiente/i }).click();
  await expect(night).toBeDisabled();
  // The exit calendar stays locked until an entry is chosen.
  await expect(page.getByText("Primero elegí la entrada")).toBeVisible();

  await page.goto(`/dashboard/agenda?fecha=${checkIn}`);
  await expect(page.getByRole("heading", { name: "Alquileres y estadías" })).toBeVisible();
  await expect(page.getByText("Entra hoy 14:00")).toBeVisible();
});

test("a service longer than the day is blocked; 8 h books across the break", async ({ page }) => {
  await page.goto("/dashboard/services/new");
  await wizardNext(page);
  await page.getByLabel("Nombre", { exact: true }).fill("Jornada completa");
  await wizardNext(page);
  // Monday is 08:00–19:00 (11 h) across the lunch break.
  await page.getByRole("radio", { name: "12 h" }).click();
  await expect(page.getByText(/nadie podría reservarlo/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByRole("button", { name: "Usar 11 h" }).click();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  await page.getByRole("radio", { name: "8 h" }).click();
  await wizardNext(page);
  await page.getByLabel("Precio").pressSequentially("1500000");
  await wizardNext(page);
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("Servicio creado")).toBeVisible();

  await page.goto(`/${USERS.h.slug}`);
  await page.getByRole("button", { name: /Jornada completa/ }).click();
  await expect(page.getByRole("button", { name: "08:00" }).first()).toBeVisible();

  // Scroll arrows on the days strip: only toward where there is more.
  const previous = page.getByRole("button", { name: "Días: anteriores" });
  const next = page.getByRole("button", { name: "Días: siguientes" });
  await expect(previous).toHaveCount(0);
  await expect(next).toBeVisible();
  for (let i = 0; i < 10 && (await next.count()) > 0; i++) {
    await next.click();
    // Let the smooth scroll finish before the next click.
    await page.waitForTimeout(500);
  }
  await expect(next).toHaveCount(0);
  await expect(previous).toBeVisible();
});

test("Nuevo turno asks turno or rental, then books a rental with a new client and a custom price", async ({ page }) => {
  await page.goto("/dashboard/agenda/new");
  await expect(page.getByRole("heading", { name: "¿Qué vas a agendar?" })).toBeVisible();
  await page.getByRole("link", { name: /Un alquiler/ }).click();
  await expect(page.getByRole("heading", { name: "Nuevo alquiler", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await page.getByLabel("Nombre y apellido").fill("Marta Mostrador");
  await page.getByLabel("Teléfono / WhatsApp").fill("0981 900 003");
  // The nights booked online are taken here too.
  const arrival = page.getByRole("region", { name: /¿Qué día llegás\?/ });
  await pickCalendarDate(arrival, plusDays(40));
  await pickCalendarDate(page.getByRole("region", { name: /¿Qué día te vas\?/ }), plusDays(42));
  const price = page.getByLabel("Precio total");
  await expect(price).toHaveValue("600.000");
  await price.fill("550000");
  await page.getByRole("button", { name: "Agendar alquiler" }).click();
  await expect(page.getByText("Alquiler agendado")).toBeVisible();
  await expect(page.getByText("Marta Mostrador").first()).toBeVisible();
  await expect(page.getByText(/550\.000/).first()).toBeVisible();
});

test("a plan with a custom period, paid at the end", async ({ page }) => {
  await page.goto("/dashboard/planes/new");
  await page.getByLabel("Nombre", { exact: true }).fill("Cada 10 días");
  await wizardNext(page);
  await page.getByLabel("Precio de cada cuota").pressSequentially("50000");
  await wizardNext(page);
  await page.getByLabel("Cada cuántos").fill("10");
  await page.getByLabel("Unidad", { exact: true }).selectOption("day");
  await expect(page.getByText("Se cobra cada 10 días.")).toBeVisible();
  await wizardNext(page);
  await page.getByRole("radio", { name: /A período vencido/ }).click();
  await wizardNext(page);
  await expect(page.getByText(/sus primeras cuotas vencen el/)).toBeVisible();
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("link", { name: /Cada 10 días/ })).toContainText("cada 10 días");

  // Enroll someone: with "al terminar el período" nothing is owed today.
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Nombre y apellido").fill("Pablo Vencido");
  await page.getByLabel("Teléfono / WhatsApp").fill("0981 900 002");
  await page.getByRole("button", { name: /Guardar/ }).click();
  await page.getByRole("link", { name: "Inscribir en un plan" }).click();
  await wizardNext(page);
  await wizardNext(page);
  // The plan is paid at the end, so that's the suggested choice.
  await expect(page.getByRole("radio", { name: /Al terminar el primer período/ })).toHaveAttribute("aria-checked", "true");
  await wizardNext(page);
  await expect(page.getByText(/1ª cuota:/)).toBeVisible();
  await page.getByRole("button", { name: "Inscribir", exact: true }).click();
  await expect(page.getByText("Inscripción creada")).toBeVisible();
  const membership = page.locator("section").filter({ has: page.getByRole("heading", { name: "Membresía" }) });
  await expect(membership).toContainText("paga a período vencido");
  await expect(membership.getByText("Vencida", { exact: true })).toHaveCount(0);
});

test("tolerance accepts a custom value like one month", async ({ page }) => {
  await page.goto("/dashboard/settings?seccion=cuotas&editar=cuotas");
  await page.getByLabel("Tolerancia", { exact: true }).selectOption("custom");
  await page.getByLabel("Cantidad de tolerancia").fill("2");
  await page.getByLabel("Unidad de tolerancia").selectOption("month");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Configuración de cuotas guardada")).toBeVisible();
  await page.goto("/dashboard/settings?seccion=cuotas");
  await expect(page.getByText("2 meses", { exact: true })).toBeVisible();
});
