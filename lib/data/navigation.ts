import "server-only";

import { cache } from "react";

import { countTrayReminders, reminderAccessFor } from "@/lib/data/reminders";
import { getSetupStatus } from "@/lib/data/setup";
import { buildNavigation, patchNavItem } from "@/lib/navigation";
import { pendingSetupSections } from "@/lib/setup-steps";
import type { TenantContext } from "@/lib/tenant";

/**
 * The navigation with live state: the Recordatorios badge and "falta
 * configurar" dots. Deduplicated per request (sidebar + phone tab bar).
 */
export const getNavigation = cache(async (ctx: TenantContext) => {
  const [remindersToSend, status] = await Promise.all([
    reminderAccessFor(ctx).then((access) => countTrayReminders(ctx, access)),
    getSetupStatus(ctx),
  ]);
  let navigation = patchNavItem(buildNavigation(ctx.settings), "reminders", { badge: remindersToSend });
  for (const section of pendingSetupSections(ctx.settings, status)) {
    navigation = patchNavItem(navigation, section, { todo: true });
  }
  return navigation;
});
