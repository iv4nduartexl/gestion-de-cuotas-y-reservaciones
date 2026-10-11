// Values and defaults of the setup wizards. Kept out of the "use client"
// wizard files so server pages can build the initial values.

import type { BillingTiming, IntervalUnit } from "@/lib/membership-constants";
import type { BookingType, StayUnit } from "@/lib/service-constants";

export type ServiceWizardValues = {
  bookingType: BookingType;
  name: string;
  description: string;
  durationMinutes: number;
  price: number | null;
  staffIds: string[];
  stayUnit: StayUnit;
  checkInTime: string;
  checkOutTime: string;
  minStay: number;
  maxStay: number | null;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
};

export const NEW_SERVICE_VALUES = (staffIds: string[]): ServiceWizardValues => ({
  bookingType: "slot",
  name: "",
  description: "",
  durationMinutes: 30,
  price: null,
  staffIds,
  stayUnit: "night",
  checkInTime: "14:00",
  checkOutTime: "10:00",
  minStay: 1,
  maxStay: null,
  weeklyPrice: null,
  monthlyPrice: null,
});

export type PlanWizardValues = {
  name: string;
  description: string;
  price: number | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  billingTiming: BillingTiming;
};

export const NEW_PLAN_VALUES: PlanWizardValues = {
  name: "",
  description: "",
  price: null,
  intervalUnit: "month",
  intervalCount: 1,
  billingTiming: "advance",
};

