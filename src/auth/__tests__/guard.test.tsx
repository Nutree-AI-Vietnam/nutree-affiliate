import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireRole } from "../guard";
import { saveSession, clearSession } from "../session";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<div>admin area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  beforeEach(() => clearSession());

  it("redirects to login when no session", () => {
    renderAt("/admin");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("redirects when role does not match", () => {
    saveSession({ affiliateId: "a1", name: "A", email: "a@x.com", role: "pt", onboarded: true });
    renderAt("/admin");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the child route when role matches", () => {
    saveSession({ affiliateId: "admin1", name: "Admin", email: "a@n.com", role: "admin", onboarded: true });
    renderAt("/admin");
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });
});
