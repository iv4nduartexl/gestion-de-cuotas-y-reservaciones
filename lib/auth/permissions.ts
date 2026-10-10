import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// Shared by the server (lib/auth) and the client (lib/auth/client).
// Domain resources (services, appointments, plans...) get added here in
// later phases.
export const statements = {
  ...defaultStatements,
  businessSettings: ["update"],
  client: ["create", "update", "archive"],
  service: ["create", "update", "archive"],
  staff: ["create", "update", "archive"],
  availability: ["update"],
  // Members may only manage blocks of their own staff record (enforced in
  // app/dashboard/blocked-slots/actions.ts).
  blockedSlot: ["create", "delete"],
  // Members may only manage turnos of their own staff record (enforced in
  // app/dashboard/agenda/actions.ts).
  appointment: ["create", "update", "cancel"],
  plan: ["create", "update", "archive"],
  enrollment: ["create", "update"],
  // Members may record payments; undoing and waiving is for owners/admins.
  payment: ["create", "delete", "void"],
  // Members only see turno reminders of their own staff record (enforced in
  // app/dashboard/recordatorios/actions.ts).
  reminder: ["send"],
} as const;

const manageDomain = {
  client: ["create", "update", "archive"],
  service: ["create", "update", "archive"],
  staff: ["create", "update", "archive"],
  availability: ["update"],
  blockedSlot: ["create", "delete"],
  appointment: ["create", "update", "cancel"],
  plan: ["create", "update", "archive"],
  enrollment: ["create", "update"],
  payment: ["create", "delete", "void"],
  reminder: ["send"],
} as const;

export const ac = createAccessControl(statements);

export const owner = ac.newRole({
  ...ownerAc.statements,
  businessSettings: ["update"],
  ...manageDomain,
});

export const admin = ac.newRole({
  ...adminAc.statements,
  businessSettings: ["update"],
  ...manageDomain,
});

export const member = ac.newRole({
  ...memberAc.statements,
  client: ["create", "update"],
  blockedSlot: ["create", "delete"],
  appointment: ["create", "update", "cancel"],
  payment: ["create"],
  reminder: ["send"],
});

export const roles = { owner, admin, member };

export type OrganizationRole = keyof typeof roles;

export const roleLabels: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};
