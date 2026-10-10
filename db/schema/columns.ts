import { text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth";

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Every tenant-owned row belongs to exactly one organization.
export const organizationIdColumn = () =>
  text()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
