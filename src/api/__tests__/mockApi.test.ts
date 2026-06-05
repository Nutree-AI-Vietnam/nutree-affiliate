import { describe, it, expect } from "vitest";
import { createMockApi } from "../mockApi";
import { COMMISSION_PER_CONVERSION } from "../fixtures";

describe("mockApi", () => {
  it("logs in a PT with valid credentials", async () => {
    const api = createMockApi();
    const session = await api.login("alex@pt.com", "password");
    expect(session.role).toBe("pt");
    expect(session.affiliateId).toBe("a1");
  });

  it("rejects invalid credentials", async () => {
    const api = createMockApi();
    await expect(api.login("alex@pt.com", "wrong")).rejects.toThrow();
  });

  it("computes totalPayout as activeSubscriptions * commission", async () => {
    const api = createMockApi();
    await api.login("alex@pt.com", "password");
    const stats = await api.getMyStats();
    expect(stats.totalPayout).toBe(64 * COMMISSION_PER_CONVERSION);
    expect(stats.activeSubscriptions).toBe(64);
  });

  it("returns admin overview with aggregated totals", async () => {
    const api = createMockApi();
    await api.login("admin@nutree.app", "admin");
    const overview = await api.getAdminOverview();
    expect(overview.affiliates.length).toBe(3);
    expect(overview.totalRevenue).toBe(4820 + 2310 + 3900);
    expect(overview.commissionPerConversion).toBe(COMMISSION_PER_CONVERSION);
  });

  it("saves and returns bank info for current PT", async () => {
    const api = createMockApi();
    await api.login("sam@pt.com", "password");
    expect(await api.getMyBankInfo()).toBeNull();
    const info = { bankName: "B", accountHolder: "H", accountNumber: "1" };
    await api.saveBankInfo(info);
    expect(await api.getMyBankInfo()).toEqual(info);
  });
});
