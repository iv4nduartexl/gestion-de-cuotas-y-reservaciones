import { describe, expect, it } from "vitest";

import { reminderEmail } from "@/lib/messaging/templates";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe";

const SECRET = "s".repeat(40);
const ID = "3f0c1d2e-4b5a-4c6d-8e7f-001122334455";

describe("unsubscribe tokens", () => {
  it("round-trips and rejects tampering", () => {
    const token = createUnsubscribeToken(ID, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(ID);
    expect(verifyUnsubscribeToken(token, "other".repeat(10))).toBeNull();
    const other = Buffer.from("3f0c1d2e-4b5a-4c6d-8e7f-001122334466").toString("base64url");
    expect(verifyUnsubscribeToken(`${other}.${token.split(".")[1]}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("garbage", SECRET)).toBeNull();
  });
});

describe("reminder email with unsubscribe", () => {
  const data = { kind: "charge_due", nombre: "Ana", plan: "Mensual", negocio: "Gym", monto: "Gs. 100.000", vencimiento: "10/10/2026", dias: 0 } as const;

  it("adds a footer and one-click headers", () => {
    const email = reminderEmail("a@b.c", data, { unsubscribe: { page: "https://x/baja/t", oneClick: "https://x/api/baja/t" } });
    expect(email.text).toContain("https://x/baja/t");
    expect(email.html).toContain('href="https://x/baja/t"');
    expect(email.headers).toEqual({ "List-Unsubscribe": "<https://x/api/baja/t>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("has no headers without a link", () => {
    expect(reminderEmail("a@b.c", data).headers).toBeUndefined();
  });
});
