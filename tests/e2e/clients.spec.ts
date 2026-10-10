import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.a.storageState });

test("create, find, edit and archive a client, with Paraguayan formats", async ({ page }) => {
  await page.goto("/dashboard/clients");
  await page.getByRole("link", { name: "Agregar cliente" }).first().click();

  await page.getByLabel("Nombre y apellido").fill("María González");
  const phone = page.getByLabel("Teléfono / WhatsApp");
  await phone.pressSequentially("0981111222");
  await expect(phone).toHaveValue("0981 111 222");
  const ci = page.getByLabel(/C\.I\./);
  await ci.pressSequentially("4567890");
  await expect(ci).toHaveValue("4.567.890");
  await page.getByLabel(/Correo/).fill("maria@example.com");
  await page.getByRole("button", { name: "Guardar cliente" }).click();

  await expect(page.getByRole("heading", { name: "María González" })).toBeVisible();
  await expect(page.getByText("Cliente guardado")).toBeVisible();
  await expect(page.getByText("C.I. 4.567.890")).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/595981111222");

  // Edit stays on the page and confirms with a toast.
  await page.getByLabel("Notas").fill("Prefiere los sábados");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();

  // Search by local phone format.
  await page.goto("/dashboard/clients");
  await page.getByLabel("Buscar clientes").fill("0981 111");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("link", { name: "María González" }).first()).toBeVisible();

  // Archive.
  await page.getByRole("link", { name: "María González" }).first().click();
  await page.getByRole("button", { name: "Archivar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archivar" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Restaurar" })).toBeVisible();
  await page.goto("/dashboard/clients");
  await expect(page.getByRole("link", { name: "María González" })).toHaveCount(0);
  await page.getByRole("link", { name: /Archivados|Ver archivados/ }).first().click();
  await expect(page.getByRole("link", { name: "María González" }).first()).toBeVisible();
});

test("duplicate phone shows a field error and keeps the input", async ({ page }) => {
  for (const name of ["Primero Dup", "Segundo Dup"]) {
    await page.goto("/dashboard/clients/new");
    await page.getByLabel("Nombre y apellido").fill(name);
    await page.getByLabel("Teléfono / WhatsApp").fill("0982 333 444");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
  }
  await expect(page.getByText("Ya existe un cliente con ese teléfono.")).toBeVisible();
  await expect(page.getByLabel("Nombre y apellido")).toHaveValue("Segundo Dup");
  await expect(page.getByLabel("Teléfono / WhatsApp")).toHaveValue("0982 333 444");
});

test("invalid phone is rejected", async ({ page }) => {
  await page.goto("/dashboard/clients/new");
  await page.getByLabel("Nombre y apellido").fill("Teléfono Malo");
  await page.getByLabel("Teléfono / WhatsApp").fill("123");
  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(page.getByText(/Teléfono inválido/)).toBeVisible();
});
