import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { organizationIdColumn } from "./columns";

/**
 * Old public links of a business. When the slug changes, the old one keeps
 * working (redirect) and can't be taken by another business.
 */
export const slugRedirects = pgTable("slug_redirects", {
  slug: text().primaryKey(),
  organizationId: text()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Who did what (sensitive actions only): payments undone, cuotas voided,
 * roles changed, exports... Append-only; shown in Configuración → Actividad.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: organizationIdColumn(),
    // Better Auth user id (kept even if the member leaves).
    actorUserId: text(),
    actorName: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    details: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_org_created_idx").on(t.organizationId, t.createdAt)],
);
