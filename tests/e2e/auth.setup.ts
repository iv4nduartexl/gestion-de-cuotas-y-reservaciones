import { expect, test as setup } from "@playwright/test";

import { createVerifiedUser, signIn, USERS } from "./helpers";

for (const user of Object.values(USERS)) {
  setup(`sign up and onboard ${user.email}`, async ({ page, request, baseURL }) => {
    await createVerifiedUser(request, user, baseURL!);
    await signIn(page, user);

    // No business yet: the guided onboarding starts.
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "¿Qué tipo de negocio tenés?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();

    await page.getByRole("button", { name: user.type }).click();
    const memberships = page.getByRole("switch", { name: "Cuotas y membresías" });
    if ((await memberships.isChecked()) !== user.memberships) await memberships.click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "¿Cómo se llama tu negocio?" })).toBeVisible();
    await page.getByLabel("Nombre del negocio").fill(user.business);
    const hasAppointments = await page.getByText("Tu link de reservas").isVisible();
    if (hasAppointments) await expect(page.getByText(`/${user.slug}`)).toBeVisible();

    if (hasAppointments) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("heading", { name: "¿Trabajás solo/a o con un equipo?" })).toBeVisible();
      if (user.team) await page.getByRole("radio", { name: /Somos un equipo/ }).click();
    }

    await page.getByRole("button", { name: "Crear mi negocio" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    // The welcome tour explains what Agenda does for this kind of business.
    const tour = page.getByRole("dialog");
    await expect(tour.getByText("¡Tu negocio está creado!")).toBeVisible();
    await expect(tour.getByRole("heading")).toHaveText(hasAppointments ? /reservan solos/ : /quién pagó y quién debe/);
    await tour.getByRole("button", { name: "Saltar" }).click();
    await expect(tour).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Guía de configuración" })).toBeVisible();

    await page.context().storageState({ path: user.storageState });
  });
}
