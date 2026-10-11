import { expect, test } from "@playwright/test";

import { USERS } from "./helpers";

test.use({ storageState: USERS.a.storageState });

test("language prefixes like /es go to the page without the prefix", async ({ page }) => {
  await page.goto("/es");
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(page.getByText("Página no encontrada")).toHaveCount(0);

  await page.goto("/es/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("¡Hola");
});
