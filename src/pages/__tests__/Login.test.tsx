import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { createMockApi } from "../../api/mockApi";
import { AuthProvider } from "../../auth/AuthProvider";
import { Login } from "../Login";

function makeMockApiWithGoogle(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return { ...createMockApi(), ...overrides };
}

function setup(api: AffiliateApi = makeMockApiWithGoogle(), initialPath = "/login") {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pt" element={<div>pt dashboard</div>} />
            <Route path="/pt/bank" element={<div>pt bank</div>} />
            <Route path="/admin" element={<div>admin overview</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ApiContext.Provider>
  );
}

describe("Login", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows the Google sign-in button after clicking Đăng nhập", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    expect(screen.getByRole("button", { name: /đăng nhập với google/i })).toBeInTheDocument();
  });

  it("navigates to /pt on successful Google sign-in as PT", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockResolvedValue({
        affiliateId: "uid1", name: "Alex", email: "alex@test.com", role: "pt", onboarded: true,
      }),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
  });

  it("navigates to /admin on successful Google sign-in as admin", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockResolvedValue({
        affiliateId: "uid2", name: "Admin", email: "admin@test.com", role: "admin", onboarded: true,
      }),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() => expect(screen.getByText("admin overview")).toBeInTheDocument());
  });

  it("shows an error when sign-in fails", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockRejectedValue(new Error("auth/network-request-failed")),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() =>
      expect(screen.getByText(/auth\/network-request-failed/i)).toBeInTheDocument()
    );
  });

  it("does not show an error when Neon starts Google redirect", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockRejectedValue(new Error("Redirecting to Google sign-in")),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() =>
      expect(screen.queryByText(/redirecting to google sign-in/i)).not.toBeInTheDocument()
    );
  });

  it("passes next path into Google sign-in", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Redirecting to Google sign-in"));
    const api = makeMockApiWithGoogle({ login });

    setup(api, "/login?next=/pt/bank");
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));

    expect(login).toHaveBeenCalledWith("/pt/bank");
  });

  it("hydrates verifier callback session and returns to safe next path", async () => {
    const api = makeMockApiWithGoogle({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "uid1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    });

    setup(api, "/login?auth=callback&neon_auth_session_verifier=test-verifier&next=/pt/bank");

    await waitFor(() => expect(screen.getByText("pt bank")).toBeInTheDocument());
  });

  it("does not trap stale callback URLs without a Neon verifier on an error state", async () => {
    const api = makeMockApiWithGoogle({
      getCurrentSession: vi.fn().mockResolvedValue(null),
    });

    setup(api, "/login?auth=callback");

    expect(screen.getByRole("button", { name: /đăng nhập với google/i })).toBeInTheDocument();
    expect(screen.queryByText(/không thể hoàn tất đăng nhập/i)).not.toBeInTheDocument();
  });

  it("keeps retrying callback hydration while Neon session is not ready yet", async () => {
    const api = makeMockApiWithGoogle({
      getCurrentSession: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          affiliateId: "uid1",
          name: "Alex",
          email: "alex@test.com",
          role: "pt",
          onboarded: true,
        }),
    });

    setup(api, "/login?auth=callback&neon_auth_session_verifier=test-verifier");

    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
  });

  it("restarts Google sign-in once when a verifier callback cannot hydrate", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Redirecting to Google sign-in"));
    const getCurrentSession = vi.fn().mockResolvedValue(null);
    const api = makeMockApiWithGoogle({ getCurrentSession, login });

    setup(api, "/login?auth=callback&neon_auth_session_verifier=missing-cookie&next=/pt/bank");

    await waitFor(() => expect(login).toHaveBeenCalledWith("/pt/bank"), { timeout: 5000 });
    expect(getCurrentSession).toHaveBeenCalled();
  });

  it("cleans up exhausted verifier callbacks and shows retryable Google login", async () => {
    sessionStorage.setItem("nutree.oauth.callbackRecoveryAttempted", "1");
    const login = vi.fn();
    const api = makeMockApiWithGoogle({
      getCurrentSession: vi.fn().mockResolvedValue(null),
      login,
    });

    setup(api, "/login?auth=callback&neon_auth_session_verifier=missing-cookie");

    await waitFor(
      () => expect(screen.getByText(/phiên đăng nhập google đã hết hạn/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /đăng nhập với google/i })).toBeEnabled();
  });
});
