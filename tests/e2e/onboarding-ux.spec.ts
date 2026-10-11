import { expect, test } from "@playwright/test";

import { USERS, sidebar, wizardNext } from "./helpers";

test.describe.configure({ mode: "serial" });
test.use({ storageState: USERS.g.storageState });

test("the welcome tour can be replayed from the user menu and walks through every screen", async ({ page }) => {
  await page.goto("/dashboard");
  // Skipped during setup: it doesn't come back on its own.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await sidebar(page).getByRole("button", { name: new RegExp(USERS.g.email) }).click();
  await page.getByRole("menuitem", { name: "¿Qué hace Agenda?" }).click();
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading")).toHaveText(/quién pagó y quién debe/);
  // A gym never hears about online bookings.
  await expect(tour).not.toContainText("reservan solos");
  await tour.getByRole("button", { name: "Siguiente" }).click();
  await expect(tour.getByRole("heading")).toHaveText("Agenda les recuerda por vos");
  await tour.getByRole("button", { name: "Siguiente" }).click();
  await expect(tour.getByRole("heading")).toHaveText("Así lo dejás listo");
  await expect(tour.getByRole("list", { name: "Pasos de la configuración" })).toContainText("Creá tus planes");
  await tour.getByRole("button", { name: "Empezar a configurar" }).click();
  await expect(tour).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the sidebar shows daily work plus “Mi negocio”, which holds the setup", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = sidebar(page);
  // A gym: Inicio, Cuotas, Recordatorios, Socios and Mi negocio. Nothing else.
  for (const name of ["Inicio", "Cuotas", "Recordatorios", "Socios", "Mi negocio"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: /^Planes/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Cuotas", exact: true })).toHaveAccessibleDescription("Quién pagó y quién debe");
  // Plans aren't set up yet: "Mi negocio" says there's something to do.
  await expect(nav.getByText("(tiene algo para revisar)")).toHaveCount(1);

  await nav.getByRole("link", { name: /^Mi negocio/ }).click();
  const plans = page.getByRole("link", { name: /^Planes/ });
  await expect(plans).toContainText("Falta configurar");
  await expect(page.getByRole("link", { name: /^Configuración/ })).toBeVisible();
});

test("the guide shows what each step produces, and pages explain themselves until set up", async ({ page }) => {
  await page.goto("/dashboard");
  const guide = page.getByRole("region", { name: "Guía de configuración" });
  await expect(guide.getByText("1 · Armá tu negocio")).toBeVisible();
  await expect(guide.getByText("Con un plan, las cuotas se arman solas")).toBeVisible();
  await expect(guide.getByText(/Inscribís a tus socios y Agenda arma sus cuotas solo/)).toBeVisible();

  await guide.getByRole("link", { name: /Crear plan/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/planes\/new$/);
  await page.getByLabel("Nombre", { exact: true }).fill("Musculación");
  await wizardNext(page);
  await page.getByLabel("Precio de cada cuota").pressSequentially("150000");
  await wizardNext(page);
  await wizardNext(page);
  await wizardNext(page);
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page).toHaveURL(/\/dashboard\/planes$/);
  // Configured now: the explanation is one tap away instead of open.
  const help = page.getByRole("button", { name: "¿Para qué sirve?" });
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await help.click();
  await expect(page.getByText(/Inscribís a un socio en un plan/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Socios" }).last()).toBeVisible();

  // An empty section opens its explanation by default.
  await page.goto("/dashboard/clients");
  await expect(page.getByRole("button", { name: "¿Para qué sirve?" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByText("(tiene algo para revisar)")).toHaveCount(0);
});

test("settings are split into sections that can be linked to", async ({ page }) => {
  await page.goto("/dashboard/settings?seccion=recordatorios");
  const tabs = page.getByRole("navigation", { name: "Secciones de configuración" });
  await expect(tabs.getByRole("link", { name: "Recordatorios" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Reservas online" })).toHaveCount(0); // gym: no online bookings
  // A summary, not a wall of forms; "Cambiar" opens only that part.
  await expect(page.getByRole("link", { name: "Cambiar cuotas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos del negocio" })).toHaveCount(0);
  await tabs.getByRole("link", { name: "Cuotas" }).click();
  await page.getByRole("link", { name: "Cambiar tolerancia" }).click();
  await expect(page.getByLabel("Tolerancia", { exact: true })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("“Más” reaches “Mi negocio”", async ({ page }) => {
    await page.goto("/dashboard");
    const tabs = page.getByRole("navigation", { name: "Navegación principal" });
    // A gym's phone tabs: Inicio, Cuotas, Socios, Recordatorios. "Mi negocio" lives in "Más".
    await expect(tabs.getByRole("link", { name: "Recordatorios" })).toBeVisible();
    await tabs.getByRole("button", { name: "Más" }).click();
    const sheet = page.getByRole("dialog", { name: "Todas las secciones" });
    await expect(sheet.getByRole("link", { name: "Mi negocio" })).toHaveAccessibleDescription(/Horarios, servicios y más/);
    await sheet.getByRole("link", { name: "Mi negocio" }).click();
    await expect(page).toHaveURL(/\/dashboard\/negocio$/);
    await expect(sheet).toBeHidden();
    await expect(tabs.getByRole("button", { name: "Más" })).toHaveClass(/text-primary/);
  });
});
