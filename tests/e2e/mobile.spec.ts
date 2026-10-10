import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.a.storageState, viewport: { width: 390, height: 844 }, hasTouch: true });

test("phones navigate with the bottom tab bar", async ({ page }) => {
  await page.goto("/dashboard");
  const tabs = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(tabs).toBeVisible();
  await tabs.getByRole("link", { name: "Clientes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  await expect(tabs.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
});
