import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { RequireRole } from "../guard";
import { saveSession, clearSession } from "../session";
import { AuthProvider } from "../AuthProvider";

function makeApi(session: Awaited<ReturnType<AffiliateApi["getCurrentSession"]>>): AffiliateApi {
  return {
    login: async () => {
      throw new Error("not used");
    },
    getCurrentSession: async () => session,
    register: async () => {
      throw new Error("not used");
    },
    logout: async () => {},
    getMyStats: async () => {
      throw new Error("not used");
    },
    getMyReferral: async () => {
      throw new Error("not used");
    },
    getMyBankInfo: async () => {
      throw new Error("not used");
    },
    saveBankInfo: async () => {
      throw new Error("not used");
    },
    getMyPayouts: async () => {
      throw new Error("not used");
    },
    getAdminOverview: async () => {
      throw new Error("not used");
    },
    markPayoutPaid: async () => {},
    getCommissionSetting: async () => {
      throw new Error("not used");
    },
  };
}

function renderAt(path: string, session: Awaited<ReturnType<AffiliateApi["getCurrentSession"]>>) {
  return render(
    <ApiContext.Provider value={makeApi(session)}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>login page</div>} />
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin" element={<div>admin area</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ApiContext.Provider>
  );
}

describe("RequireRole", () => {
  beforeEach(() => clearSession());

  it("shows an auth loading state while checking Neon session", () => {
    renderAt("/admin", null);
    expect(screen.getByText("Đang xác thực…")).toBeInTheDocument();
  });

  it("redirects to login with next path when no live session exists", async () => {
    renderAt("/admin?tab=payouts", null);
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });

  it("does not trust stale local session when Neon has no session", async () => {
    saveSession({ affiliateId: "admin1", name: "Admin", email: "a@n.com", role: "admin", onboarded: true });
    renderAt("/admin", null);
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });

  it("redirects when live session role does not match", async () => {
    saveSession({ affiliateId: "a1", name: "A", email: "a@x.com", role: "pt", onboarded: true });
    renderAt("/admin", { affiliateId: "a1", name: "A", email: "a@x.com", role: "pt", onboarded: true });
    expect(await screen.findByText("login page")).toBeInTheDocument();
  });

  it("renders the child route when live session role matches", async () => {
    renderAt("/admin", { affiliateId: "admin1", name: "Admin", email: "a@n.com", role: "admin", onboarded: true });
    expect(await screen.findByText("admin area")).toBeInTheDocument();
  });
});
