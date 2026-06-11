import { describe, it, expect } from "vitest";
import { currency, dateOrDash } from "../format";

describe("format helpers", () => {
  it("formats currency in VND", () => {
    expect(currency(4820)).toBe("4.820 ₫");
  });
  it("renders dash for null dates", () => {
    expect(dateOrDash(null)).toBe("—");
  });
  it("passes through a date string", () => {
    expect(dateOrDash("2026-05-28")).toBe("2026-05-28");
  });
});
