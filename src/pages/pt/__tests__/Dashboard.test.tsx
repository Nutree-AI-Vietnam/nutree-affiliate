import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiContext } from "../../../api";
import { createMockApi } from "../../../api/mockApi";
import { saveSession } from "../../../auth/session";
import { ThemeProvider } from "../../../lib/ThemeContext";
import { Dashboard } from "../Dashboard";

describe("PT Dashboard", () => {
  beforeEach(() => localStorage.clear());

  it("shows the PT stats after loading", async () => {
    const api = createMockApi();
    api.loginAs("alex@pt.com");
    await api.login();
    saveSession({ affiliateId: "a1", name: "Alex R.", email: "alex@pt.com", role: "pt" });
    render(
      <ApiContext.Provider value={api}>
        <ThemeProvider>
          <MemoryRouter><Dashboard /></MemoryRouter>
        </ThemeProvider>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("$4,820")).toBeInTheDocument());
    expect(screen.getByText("Tổng doanh thu")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument(); // active subs
  });
});
