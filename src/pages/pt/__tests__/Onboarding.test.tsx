import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiContext, type AffiliateApi } from "../../../api";
import { AuthProvider } from "../../../auth/AuthProvider";
import { RequireRole } from "../../../auth/guard";
import { clearSession } from "../../../auth/session";
import { getNeonAuthToken } from "../../../lib/neon-auth";
import { Onboarding } from "../Onboarding";

vi.mock("../../../lib/neon-auth", () => ({
  getNeonAuthToken: vi.fn(),
}));

const session = {
  affiliateId: "aff-1",
  name: "Alex",
  email: "alex@test.com",
  role: "pt" as const,
  onboarded: false,
};

function makeApi(): AffiliateApi {
  return {
    login: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(session),
    register: vi.fn(),
    logout: vi.fn(),
    getMyStats: vi.fn(),
    getMyReferral: vi.fn(),
    getMyBankInfo: vi.fn(),
    saveBankInfo: vi.fn(),
    getMyPayouts: vi.fn(),
    getAdminOverview: vi.fn(),
    markPayoutPaid: vi.fn(),
    getCommissionSetting: vi.fn(),
    getMyConversions: vi.fn(),
    getMyMonthlyEarnings: vi.fn(),
    requestPayout: vi.fn(),
    getAdminAffiliateDetail: vi.fn(),
    getAdminPayoutRequests: vi.fn(),
    approvePayoutRequest: vi.fn(),
  };
}

function renderOnboarding(api = makeApi()) {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={["/pt/onboarding"]}>
        <AuthProvider>
          <Routes>
            <Route element={<RequireRole role="pt" />}>
              <Route path="/pt/onboarding" element={<Onboarding />} />
              <Route path="/pt" element={<div>pt dashboard</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ApiContext.Provider>,
  );
}

describe("Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    }));
    vi.mocked(getNeonAuthToken).mockResolvedValue("test-token");
    clearSession();
  });

  it("updates auth state and navigates to the PT dashboard after a 200 response", async () => {
    renderOnboarding();

    await screen.findByRole("heading", { name: "Tạo hồ sơ của bạn" });
    await userEvent.clear(screen.getByPlaceholderText("Nguyễn Văn A"));
    await userEvent.type(screen.getByPlaceholderText("Nguyễn Văn A"), "Alex Nguyen");
    await userEvent.type(screen.getByPlaceholderText("VD: TOBEY"), "ALEX123");
    await userEvent.click(screen.getByRole("button", { name: /bắt đầu/i }));

    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/affiliate/onboard", expect.objectContaining({
      method: "POST",
    }));
  });
});
