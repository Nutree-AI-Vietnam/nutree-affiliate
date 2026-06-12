import { describe, expect, it } from "vitest";
import { normalizeCatchAllPath, normalizeRequestPath } from "../path-routing";

describe("normalizeCatchAllPath", () => {
  it("keeps the plain catch-all path", () => {
    expect(normalizeCatchAllPath("me", "affiliate")).toEqual(["me"]);
    expect(normalizeCatchAllPath(["overview"], "admin")).toEqual(["overview"]);
  });

  it("strips the base segment when Vercel includes it", () => {
    expect(normalizeCatchAllPath("affiliate/me", "affiliate")).toEqual(["me"]);
    expect(normalizeCatchAllPath(["admin", "overview"], "admin")).toEqual(["overview"]);
  });

  it("strips api and base segments when Vercel includes the full API path", () => {
    expect(normalizeCatchAllPath("api/affiliate/me", "affiliate")).toEqual(["me"]);
    expect(normalizeCatchAllPath(["api", "admin", "overview"], "admin")).toEqual(["overview"]);
  });

  it("falls back to request URLs when Vercel omits the catch-all query param", () => {
    expect(normalizeRequestPath("/api/affiliate/me?x=1", "affiliate")).toEqual(["me"]);
    expect(normalizeRequestPath("https://example.test/api/admin/overview", "admin")).toEqual(["overview"]);
  });
});
