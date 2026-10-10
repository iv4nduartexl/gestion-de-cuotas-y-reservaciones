import { expect, test } from "@playwright/test";

import { sidebar, USERS } from "./helpers";

test("a business can't open another business's client, and products gate pages", async ({ browser }) => {
  // Business A creates a client and grabs its URL.
  const contextA = await browser.newContext({ storageState: USERS.a.storageState });
  const pageA = await contextA.newPage();
  await pageA.goto("/dashboard/clients/new");
  await pageA.getByLabel("Nombre y apellido").fill("Secreto de Alfa");
  await pageA.getByLabel("Teléfono / WhatsApp").fill("0983 555 666");
  await pageA.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(pageA.getByRole("heading", { name: "Secreto de Alfa" })).toBeVisible();
  const clientUrl = pageA.url().replace(/\?.*$/, "");
  await contextA.close();

  // Business B (a gym: memberships only) gets a 404 and never sees the data.
  const contextB = await browser.newContext({ storageState: USERS.b.storageState });
  const pageB = await contextB.newPage();
  await pageB.goto(clientUrl);
  await expect(pageB.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(pageB.getByText("Secreto de Alfa")).toHaveCount(0);

  // A gym calls its clients "Socios", and has no appointment sections.
  await pageB.goto("/dashboard");
  await expect(sidebar(pageB).getByRole("link", { name: "Socios" })).toBeVisible();
  await expect(sidebar(pageB).getByRole("link", { name: "Servicios" })).toHaveCount(0);
  await expect(sidebar(pageB).getByRole("link", { name: "Horarios" })).toHaveCount(0);
  for (const path of ["/dashboard/services", "/dashboard/schedule", "/dashboard/staff"]) {
    await pageB.goto(path);
    await expect(pageB.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  }
  await contextB.close();
});
