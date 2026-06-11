import { render, screen, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { AUTH_REQUIRED_EVENT } from "../auth-events";
import { AuthProvider, useAuth } from "../AuthProvider";
import { clearSession, loadSession, saveSession } from "../session";

function makeApi(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return {
    login: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(null),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
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
    ...overrides,
  };
}

function Probe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.session?.email ?? "none"}</span>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </div>
  );
}

function renderWithApi(api: AffiliateApi, children: ReactNode = <Probe />) {
  return render(
    <ApiContext.Provider value={api}>
      <AuthProvider>{children}</AuthProvider>
    </ApiContext.Provider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("bootstraps from getCurrentSession and exposes the authenticated session", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    });

    renderWithApi(api);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(api.getCurrentSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId("email")).toHaveTextContent("alex@test.com");
    expect(loadSession()).toEqual({
      affiliateId: "aff-1",
      name: "Alex",
      email: "alex@test.com",
      role: "pt",
      onboarded: true,
    });
  });

  it("clears a stale local session when getCurrentSession returns null", async () => {
    saveSession({
      affiliateId: "stale-affiliate",
      name: "Stale",
      email: "stale@test.com",
      role: "pt",
      onboarded: true,
    });
    const api = makeApi({ getCurrentSession: vi.fn().mockResolvedValue(null) });

    renderWithApi(api);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(api.getCurrentSession).toHaveBeenCalledOnce();
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(loadSession()).toBeNull();
  });

  it("clears auth state and local session when auth-required is dispatched", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    });

    renderWithApi(api);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
    });

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(loadSession()).toBeNull();
  });

  it("logout calls API logout and clears local auth state", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "aff-1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
      logout: vi.fn().mockRejectedValue(new Error("network down")),
    });

    renderWithApi(api);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    act(() => {
      screen.getByRole("button", { name: "logout" }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(api.logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(loadSession()).toBeNull();
  });
});
