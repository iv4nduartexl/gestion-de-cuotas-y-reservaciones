import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import pg from "pg";

export const PASSWORD = "supersecreta1";

export const USERS = {
  // "Otro rubro" + turnos + cuotas, working as a team: exercises every section.
  a: {
    name: "Ana Owner",
    email: "ana@e2e.test",
    business: "Barbería Alfa",
    slug: "barberia-alfa",
    type: /Otro rubro/,
    memberships: true,
    team: true,
    storageState: "tests/e2e/.auth/a.json",
  },
  // Gimnasio: memberships only, so appointment sections are hidden.
  b: {
    name: "Beto Owner",
    email: "beto@e2e.test",
    business: "Gimnasio Beta",
    slug: "gimnasio-beta",
    type: /Gimnasio/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/b.json",
  },
  // Used only by the settings test, which changes what the business uses.
  c: {
    name: "Carla Owner",
    email: "carla@e2e.test",
    business: "Gimnasio Carla",
    slug: "gimnasio-carla",
    type: /Gimnasio/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/c.json",
  },
  // Solo barbería used by the public booking tests.
  d: {
    name: "Dario Owner",
    email: "dario@e2e.test",
    business: "Barbería Delta",
    slug: "barberia-delta",
    type: /Barbería/,
    memberships: false,
    team: false,
    storageState: "tests/e2e/.auth/d.json",
  },
  // Gym used by the memberships tests.
  e: {
    name: "Elena Owner",
    email: "elena@e2e.test",
    business: "Gimnasio Épsilon",
    slug: "gimnasio-epsilon",
    type: /Gimnasio/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/e.json",
  },
  // Turnos + cuotas, solo: used by the reminders tests.
  f: {
    name: "Fabi Owner",
    email: "fabi@e2e.test",
    business: "Estudio Foxtrot",
    slug: "estudio-foxtrot",
    type: /Otro rubro/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/f.json",
  },
  // Fresh gym used by the onboarding/UX tests.
  g: {
    name: "Gabi Owner",
    email: "gabi@e2e.test",
    business: "Gimnasio Golf",
    slug: "gimnasio-golf",
    type: /Gimnasio/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/g.json",
  },
  // Turnos + cuotas, solo: used by the flexibility tests (rentals, custom periods).
  h: {
    name: "Hugo Owner",
    email: "hugo@e2e.test",
    business: "Quinta Hotel",
    slug: "quinta-hotel",
    type: /Otro rubro/,
    memberships: true,
    team: false,
    storageState: "tests/e2e/.auth/h.json",
  },
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];

/** The developer admin (ADMIN_EMAILS in playwright.config.ts); owns no business. */
export const ADMIN = { name: "Dev Admin", email: "admin@e2e.test" };

/** Signs up through the API and marks the email verified (no inbox in tests). */
export async function createVerifiedUser(request: APIRequestContext, user: { name: string; email: string }, baseURL: string) {
  const response = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { name: user.name, email: user.email, password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('update "user" set email_verified = true where email = $1', [user.email]);
  await client.end();
}

export async function signIn(page: Page, user: { email: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

/** The sidebar (desktop). */
export function sidebar(page: Page) {
  return page.locator("[data-sidebar=sidebar]").first();
}

/** Local date ("yyyy-MM-dd") of an ISO instant in Asunción. */
export function asuncionDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** The clock time picker labelled `label` (its group of HH : mm fields). */
export function timePicker(scope: Locator | Page, label: string | RegExp, nth = 0) {
  return scope.getByRole("group", { name: label }).nth(nth);
}

/** Types a "HH:mm" time into a time picker, like a keyboard user. */
export async function setTime(picker: Locator, time: string) {
  const [hour, minute] = time.split(":");
  await picker.getByLabel(/: hora$/).fill(hour);
  await picker.getByLabel(/: minutos$/).fill(minute);
  await picker.getByLabel(/: minutos$/).blur();
}

/** Asserts the time shown by a time picker. */
export async function expectTime(picker: Locator, time: string) {
  const [hour, minute] = time.split(":");
  await expect(picker.getByLabel(/: hora$/)).toHaveValue(hour);
  await expect(picker.getByLabel(/: minutos$/)).toHaveValue(minute);
}

/** Clicks a date in an open react-day-picker calendar (Spanish), moving months if needed. */
export async function pickCalendarDate(scope: Locator | Page, date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const month = new Intl.DateTimeFormat("es-PY", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const day = scope.getByRole("button", { name: new RegExp(`(^|, )${d} de ${month} de ${y}`) });
  for (let i = 0; i < 12 && (await day.count()) === 0; i++) {
    await scope.getByRole("button", { name: /mes siguiente/i }).click();
  }
  await day.click();
}

/** "Siguiente" in a setup wizard. */
export async function wizardNext(page: Page) {
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
}

/** Creates a turno service through the wizard (team mode keeps every person checked). */
export async function createSlotService(page: Page, { name, minutes, price }: { name: string; minutes: number; price: string }) {
  await page.goto("/dashboard/services/new");
  await expect(page.getByRole("heading", { name: "¿Cómo te reservan?" })).toBeVisible();
  await wizardNext(page);
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await wizardNext(page);
  await page.getByLabel("Horas").fill(String(Math.floor(minutes / 60)));
  await page.getByLabel("Minutos").fill(String(minutes % 60));
  await wizardNext(page);
  await page.getByLabel(/^Precio/).pressSequentially(price);
  await wizardNext(page);
  if (await page.getByRole("heading", { name: /¿Quién hace/ }).isVisible()) await wizardNext(page);
  await expect(page.getByRole("heading", { name: "Revisá antes de guardar" })).toBeVisible();
  await page.getByRole("button", { name: /^Crear / }).click();
  await expect(page).toHaveURL(/\/dashboard\/services$/);
}

/** Sets weekly hours through the schedule wizard. */
export async function setScheduleWithWizard(
  page: Page,
  { days, open, close, lunch }: { days: "Lunes a viernes" | "Lunes a sábado" | "Todos los días"; open: string; close: string; lunch?: [string, string] },
) {
  await page.getByRole("button", { name: days }).click();
  await wizardNext(page);
  await setTime(timePicker(page, "Abro a las"), open);
  await setTime(timePicker(page, "Cierro a las"), close);
  await wizardNext(page);
  if (lunch) {
    await page.getByRole("radio", { name: /Sí, hago un corte/ }).click();
    await setTime(timePicker(page, "Corto a las"), lunch[0]);
    await setTime(timePicker(page, "Vuelvo a las"), lunch[1]);
  } else {
    await page.getByRole("radio", { name: /No, de corrido/ }).click();
  }
  await wizardNext(page);
  await wizardNext(page); // "¿Algún día es distinto?": no
  await expect(page.getByRole("heading", { name: "Revisá antes de guardar" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado").first()).toBeVisible();
}
