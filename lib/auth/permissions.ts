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
} as const;

const manageDomain = {
  client: ["create", "update", "archive"],
  service: ["create", "update", "archive"],
  staff: ["create", "update", "archive"],
  availability: ["update"],
  blockedSlot: ["create", "delete"],
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
});

export const roles = { owner, admin, member };

export type OrganizationRole = keyof typeof roles;

export const roleLabels: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};
