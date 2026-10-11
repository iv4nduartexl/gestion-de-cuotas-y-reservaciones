import { expect, test } from "@playwright/test";

import { ADMIN, createVerifiedUser, signIn, USERS } from "./helpers";

test.describe.configure({ mode: "serial" });

test("the admin lists every business, enters one as its owner and comes back", async ({ page, request, baseURL }) => {
  await createVerifiedUser(request, ADMIN, baseURL!);
  await signIn(page, ADMIN);
  // No business of their own: the admin console, not the onboarding.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Negocios", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Negocios" });
  for (const user of Object.values(USERS)) await expect(list).toContainText(user.business);

  await page.getByRole("searchbox", { name: "Buscar negocios" }).fill(USERS.b.email);
  await page.keyboard.press("Enter");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await list.getByRole("button", { name: `Entrar a ${USERS.b.business} como dueño` }).click();
  await expect(page.getByRole("alertdialog")).toContainText("1 hora");
  await page.getByRole("alertdialog").getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const banner = page.getByRole("status").filter({ hasText: "Modo admin" });
  await expect(banner).toContainText(USERS.b.business);
  await expect(banner).toContainText(USERS.b.name);

  // The business sees who it was.
  await page.goto("/dashboard/settings?seccion=actividad");
  await expect(page.getByText(/Soporte \(admin\)\s*soporte entró a la cuenta/i)).toBeVisible();

  await page.getByRole("status").filter({ hasText: "Modo admin" }).getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Negocios", level: 1 })).toBeVisible();
});

test.describe("everyone else", () => {
  test.use({ storageState: USERS.d.storageState });

  test("an owner can't see the console or impersonate through the API", async ({ page, baseURL }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();

    const headers = { origin: baseURL! };
    const impersonate = await page.request.post("/api/auth/admin/impersonate-user", { headers, data: { userId: "x" } });
    expect(impersonate.status()).toBe(403);
    const listUsers = await page.request.get("/api/auth/admin/list-users", { headers });
    expect(listUsers.status()).toBe(404);
  });
});
