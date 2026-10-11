import "server-only";

import { cache } from "react";

import { countTrayReminders, reminderAccessFor } from "@/lib/data/reminders";
import { findServiceProblems } from "@/lib/data/services";
import { getSetupStatus } from "@/lib/data/setup";
import { buildNavigation, patchNavItem } from "@/lib/navigation";
import { pendingSetupSections } from "@/lib/setup-steps";
import type { TenantContext } from "@/lib/tenant";

/**
 * The navigation with live state: the Recordatorios badge and a dot on
 * "Mi negocio" when something is unfinished or needs fixing. Deduplicated per request (sidebar + phone tab bar).
 */
export const getNavigation = cache(async (ctx: TenantContext) => {
  const [remindersToSend, status, problems] = await Promise.all([
    reminderAccessFor(ctx).then((access) => countTrayReminders(ctx, access)),
    getSetupStatus(ctx),
    ctx.settings.appointmentsEnabled ? findServiceProblems(ctx) : Promise.resolve(new Map()),
  ]);
  const needsAttention = pendingSetupSections(ctx.settings, status).length > 0 || problems.size > 0;
  return patchNavItem(patchNavItem(buildNavigation(ctx.settings), "reminders", { badge: remindersToSend }), "business", {
    todo: needsAttention,
  });
});
