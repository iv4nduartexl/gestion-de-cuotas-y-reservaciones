import { describe, expect, it } from "vitest";

import {
  addMonthsAnchored,
  chargeStatus,
  currentPeriodStart,
  memberStatus,
  periodsFor,
  renderReminder,
} from "@/lib/billing";
import { intervalLabel } from "@/lib/membership-constants";

describe("period math", () => {
  it("anchors on the start day, clamping short months", () => {
    expect(addMonthsAnchored("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsAnchored("2028-01-31", 1)).toBe("2028-02-29"); // leap year
    expect(addMonthsAnchored("2026-01-31", 2)).toBe("2026-03-31"); // anchor kept
    expect(addMonthsAnchored("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("monthly periods: due on the start day", () => {
    const periods = periodsFor({ startDate: "2026-08-14", unit: "month", count: 1, until: "2026-10-20" });
    expect(periods.map((p) => p.dueDate)).toEqual(["2026-08-14", "2026-09-14", "2026-10-14"]);
    expect(periods[0].periodEnd).toBe("2026-09-14");
  });

  it("month-end start dates", () => {
    const periods = periodsFor({ startDate: "2026-01-31", unit: "month", count: 1, until: "2026-05-01" });
    expect(periods.map((p) => p.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("weekly and quarterly plans", () => {
    expect(periodsFor({ startDate: "2026-10-01", unit: "week", count: 1, until: "2026-10-20" }).map((p) => p.dueDate)).toEqual([
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
    ]);
    expect(periodsFor({ startDate: "2026-01-10", unit: "month", count: 3, until: "2026-12-31" }).map((p) => p.dueDate)).toEqual([
      "2026-01-10",
      "2026-04-10",
      "2026-07-10",
      "2026-10-10",
    ]);
  });

  it("skips paused time with billFrom", () => {
    const periods = periodsFor({ startDate: "2026-01-05", billFrom: "2026-04-05", unit: "month", count: 1, until: "2026-05-10" });
    expect(periods.map((p) => p.dueDate)).toEqual(["2026-04-05", "2026-05-05"]);
  });

  it("finds the current period when resuming", () => {
    expect(currentPeriodStart("2026-01-05", "month", 1, "2026-04-20")).toBe("2026-04-05");
    expect(currentPeriodStart("2026-01-05", "month", 1, "2026-04-05")).toBe("2026-04-05");
    expect(currentPeriodStart("2026-01-05", "month", 1, "2025-12-01")).toBe("2026-01-05");
  });
});

const NONE = { count: 0, unit: "day" } as const;

describe("flexible periods", () => {
  it("bills every N days and yearly (Feb 29 anchored)", () => {
    expect(periodsFor({ startDate: "2026-10-01", unit: "day", count: 10, until: "2026-10-25" }).map((p) => p.dueDate)).toEqual([
      "2026-10-01",
      "2026-10-11",
      "2026-10-21",
    ]);
    expect(periodsFor({ startDate: "2028-02-29", unit: "year", count: 1, until: "2030-03-01" }).map((p) => p.dueDate)).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
    ]);
  });

  it("stays fast for daily plans over many years", () => {
    const periods = periodsFor({ startDate: "2020-01-01", billFrom: "2026-10-01", unit: "day", count: 1, until: "2026-10-03" });
    expect(periods.map((p) => p.dueDate)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(currentPeriodStart("2020-01-01", "day", 1, "2026-10-02")).toBe("2026-10-02");
    expect(currentPeriodStart("2026-01-31", "month", 1, "2026-03-15")).toBe("2026-02-28");
  });

  it("pays at the end of the period (arrears)", () => {
    const periods = periodsFor({ startDate: "2026-10-10", unit: "month", count: 1, until: "2026-11-15", timing: "arrears" });
    // Nothing is due on the start day: the first cuota falls due a month later.
    expect(periods).toEqual([{ periodStart: "2026-10-10", periodEnd: "2026-11-10", dueDate: "2026-11-10" }]);
    expect(periodsFor({ startDate: "2026-10-10", unit: "month", count: 1, until: "2026-10-20", timing: "arrears" })).toEqual([]);
  });

  it("uses a custom first due date and a free first period", () => {
    const custom = periodsFor({ startDate: "2026-10-10", unit: "month", count: 1, until: "2026-12-20", firstDueDate: "2026-10-25" });
    expect(custom.map((p) => p.dueDate)).toEqual(["2026-10-25", "2026-11-10", "2026-12-10"]);
    const free = periodsFor({ startDate: "2026-10-10", billFrom: "2026-11-10", unit: "month", count: 1, until: "2026-12-20" });
    expect(free.map((p) => p.dueDate)).toEqual(["2026-11-10", "2026-12-10"]);
  });
});

describe("statuses", () => {
  const charge = { status: "pending" as const, amount: 150000, dueDate: "2026-10-05" };

  it("derives pagada / parcial / pendiente / vencida / anulada", () => {
    expect(chargeStatus(charge, 0, "2026-10-05", NONE)).toBe("pendiente");
    expect(chargeStatus(charge, 50000, "2026-10-05", NONE)).toBe("parcial");
    expect(chargeStatus(charge, 0, "2026-10-06", NONE)).toBe("vencida");
    expect(chargeStatus(charge, 50000, "2026-10-06", NONE)).toBe("vencida");
    expect(chargeStatus(charge, 150000, "2026-12-01", NONE)).toBe("pagada");
    expect(chargeStatus({ ...charge, status: "void" }, 0, "2026-12-01", NONE)).toBe("anulada");
  });

  it("applies grace days", () => {
    expect(chargeStatus(charge, 0, "2026-10-10", { count: 5, unit: "day" })).toBe("pendiente");
    expect(chargeStatus(charge, 0, "2026-10-11", { count: 5, unit: "day" })).toBe("vencida");
  });

  it("applies a tolerance of weeks or months", () => {
    const oneMonth = { count: 1, unit: "month" } as const;
    expect(chargeStatus(charge, 0, "2026-11-05", oneMonth)).toBe("pendiente");
    expect(chargeStatus(charge, 0, "2026-11-06", oneMonth)).toBe("vencida");
    expect(chargeStatus(charge, 0, "2026-10-12", { count: 1, unit: "week" })).toBe("pendiente");
    expect(chargeStatus(charge, 0, "2026-10-13", { count: 1, unit: "week" })).toBe("vencida");
    // Month-end anchoring: due Jan 31 + 1 month → overdue from Mar 1.
    const endOfMonth = { ...charge, dueDate: "2027-01-31" };
    expect(chargeStatus(endOfMonth, 0, "2027-02-28", oneMonth)).toBe("pendiente");
    expect(chargeStatus(endOfMonth, 0, "2027-03-01", oneMonth)).toBe("vencida");
  });

  it("summarizes a member", () => {
    const today = "2026-10-20";
    expect(
      memberStatus(
        [
          { status: "vencida", amount: 100, amountPaid: 40, dueDate: "2026-09-14" },
          { status: "pendiente", amount: 100, amountPaid: 0, dueDate: "2026-10-25" },
          { status: "pagada", amount: 100, amountPaid: 100, dueDate: "2026-08-14" },
        ],
        today,
      ),
    ).toEqual({ kind: "vencido", owed: 60, overdue: 1 });
    expect(memberStatus([{ status: "pagada", amount: 1, amountPaid: 1, dueDate: "2026-10-01" }], today).kind).toBe("al_dia");
  });
});

describe("labels", () => {
  it("interval labels in Spanish", () => {
    expect(intervalLabel("month", 1)).toBe("por mes");
    expect(intervalLabel("month", 3)).toBe("cada 3 meses");
    expect(intervalLabel("week", 1)).toBe("por semana");
  });

  it("renders the reminder template", () => {
    expect(
      renderReminder("Hola {nombre}: {plan} {monto} venció el {vencimiento}.", {
        nombre: "Ana",
        plan: "Mensual",
        monto: "Gs. 150.000",
        vencimiento: "05/10/2026",
      }),
    ).toBe("Hola Ana: Mensual Gs. 150.000 venció el 05/10/2026.");
  });
});
