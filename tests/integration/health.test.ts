import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";
import { closeDbAfterAll } from "./fixtures";

closeDbAfterAll();

describe("health check", () => {
  it("reports the database as up", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, db: "up" });
  });
});
