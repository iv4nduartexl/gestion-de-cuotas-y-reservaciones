import "server-only";

import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { appointments, blockedSlots, services } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import { addDaysToDate, zonedToUtc } from "@/lib/datetime";
import type { StayUnit } from "@/lib/service-constants";
import { occupiedDates, type StayService } from "@/lib/stays";
import type { TenantScope } from "./scope";

export type BookableStay = StayService & {
  id: string;
  name: string;
  description: string | null;
  currency: string;
};

const stayColumns = {
  id: services.id,
  name: services.name,
  description: services.description,
  currency: services.currency,
  price: services.price,
  stayUnit: services.stayUnit,
  checkInTime: services.checkInTime,
  checkOutTime: services.checkOutTime,
  minStay: services.minStay,
  maxStay: services.maxStay,
  weeklyPrice: services.weeklyPrice,
  monthlyPrice: services.monthlyPrice,
};

type StayRow = { [K in keyof typeof stayColumns]: (typeof stayColumns)[K]["_"]["data"] | null };

/** Stay services always have their stay fields (DB check services_stay_fields). */
function toStay(row: StayRow): BookableStay {
  return {
    id: row.id!,
    name: row.name!,
    description: row.description,
    currency: row.currency!,
    price: row.price!,
    stayUnit: row.stayUnit as StayUnit,
    checkInTime: row.checkInTime!,
    checkOutTime: row.checkOutTime!,
    minStay: row.minStay!,
    maxStay: row.maxStay,
    weeklyPrice: row.weeklyPrice,
    monthlyPrice: row.monthlyPrice,
  };
}

/** Active rentals ("Por días" services) of the business. */
export async function listStayServices(ctx: TenantScope): Promise<BookableStay[]> {
  const rows = await db
    .select(stayColumns)
    .from(services)
    .where(and(eq(services.organizationId, ctx.organization.id), eq(services.bookingType, "stay"), isNull(services.archivedAt)))
    .orderBy(asc(services.name));
  return rows.map(toStay);
}

export async function getStayService(ctx: TenantScope, id: string): Promise<BookableStay | null> {
  const [row] = await db
    .select(stayColumns)
    .from(services)
    .where(
      and(
        eq(services.organizationId, ctx.organization.id),
        eq(services.id, id),
        eq(services.bookingType, "stay"),
        isNull(services.archivedAt),
      ),
    );
  return row ? toStay(row) : null;
}

/**
 * Dates of a rental that are taken between `fromDate` and `toDate` (local
 * calendar dates): active stays of the service plus business-wide días libres.
 */
export async function loadOccupiedDates(ctx: TenantScope, service: BookableStay, fromDate: string, toDate: string, excludeId?: string) {
  const tz = ctx.settings.timezone;
  const from = zonedToUtc(fromDate, "00:00", tz);
  const to = zonedToUtc(addDaysToDate(toDate, 1), "00:00", tz);
  const [stays, closures] = await Promise.all([
    db
      .select({ id: appointments.id, start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, ctx.organization.id),
          eq(appointments.serviceId, service.id),
          eq(appointments.kind, "stay"),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          lt(appointments.startsAt, to),
          gt(appointments.endsAt, from),
        ),
      ),
    db
      .select({ start: blockedSlots.startsAt, end: blockedSlots.endsAt })
      .from(blockedSlots)
      .where(
        and(
          eq(blockedSlots.organizationId, ctx.organization.id),
          isNull(blockedSlots.staffId),
          lt(blockedSlots.startsAt, to),
          gt(blockedSlots.endsAt, from),
        ),
      ),
  ]);
  const busy = [...stays.filter((stay) => stay.id !== excludeId), ...closures];
  return occupiedDates(service.stayUnit, busy, tz);
}
