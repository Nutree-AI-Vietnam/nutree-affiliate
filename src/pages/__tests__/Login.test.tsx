import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { createMockApi } from "../../api/mockApi";
import { Login } from "../Login";

function makeMockApiWithGoogle(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return { ...createMockApi(), ...overrides };
}

function setup(api: AffiliateApi = makeMockApiWithGoogle()) {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pt" element={<div>pt dashboard</div>} />
          <Route path="/admin" element={<div>admin overview</div>} />
        </Routes>
      </MemoryRouter>
    </ApiContext.Provider>
  );
}

describe("Login", () => {
  it("shows the Google sign-in button after clicking Đăng nhập", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    expect(screen.getByRole("button", { name: /đăng nhập với google/i })).toBeInTheDocument();
  });

  it("navigates to /pt on successful Google sign-in as PT", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockResolvedValue({
        affiliateId: "uid1", name: "Alex", email: "alex@test.com", role: "pt",
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
        affiliateId: "uid2", name: "Admin", email: "admin@test.com", role: "admin",
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

  it("does not show an error when popup is closed by user", async () => {
    const api = makeMockApiWithGoogle({
      login: vi.fn().mockRejectedValue(new Error("popup-closed")),
    });
    setup(api);
    await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));
    await waitFor(() =>
      expect(screen.queryByText(/popup-closed/i)).not.toBeInTheDocument()
    );
  });
});
