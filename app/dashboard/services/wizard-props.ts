import "server-only";

import { vocabularyFor } from "@/lib/business-types";
import { longestTurnoByStaff } from "@/lib/data/availability";
import { listStaff } from "@/lib/data/staff";
import { exampleServices } from "@/lib/help-content";
import { currencyPrefix } from "@/lib/money";
import type { TenantContext } from "@/lib/tenant";

/** Everything the service wizard needs from the server. */
export async function serviceWizardProps(ctx: TenantContext) {
  const words = vocabularyFor(ctx.settings.businessType);
  const [staffRows, longestByStaff] = await Promise.all([listStaff(ctx), longestTurnoByStaff(ctx)]);
  return {
    staffOptions: staffRows.map(({ id, name }) => ({ id, name, hasHours: longestByStaff[id] !== undefined })),
    showStaff: ctx.settings.teamMode === "team",
    longestByStaff,
    currency: ctx.settings.currency,
    currencyPrefix: currencyPrefix(ctx.settings.currency),
    words: { service: words.service.one, staff: words.staff.one, staffMany: words.staff.many },
    example: exampleServices(ctx.settings.businessType)[0],
  };
}
