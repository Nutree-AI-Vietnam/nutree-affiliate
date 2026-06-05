import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession } from "../session";

describe("session storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when no session stored", () => {
    expect(loadSession()).toBeNull();
  });

  it("saves and loads a session", () => {
    const s = { affiliateId: "a1", name: "A", email: "a@x.com", role: "pt" as const };
    saveSession(s);
    expect(loadSession()).toEqual(s);
  });

  it("clears the session", () => {
    saveSession({ affiliateId: "a1", name: "A", email: "a@x.com", role: "pt" });
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
