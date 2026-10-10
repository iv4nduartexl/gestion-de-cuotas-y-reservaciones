import { expect, type APIRequestContext, type Page } from "@playwright/test";
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
} as const;

export type TestUser = (typeof USERS)[keyof typeof USERS];

/** Signs up through the API and marks the email verified (no inbox in tests). */
export async function createVerifiedUser(request: APIRequestContext, user: TestUser, baseURL: string) {
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

export async function signIn(page: Page, user: TestUser) {
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
