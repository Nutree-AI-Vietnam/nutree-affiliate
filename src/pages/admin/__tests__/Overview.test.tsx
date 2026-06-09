import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiContext } from "../../../api";
import { createMockApi } from "../../../api/mockApi";
import { saveSession } from "../../../auth/session";
import { ThemeProvider } from "../../../lib/ThemeContext";
import { Overview } from "../Overview";

describe("Admin Overview", () => {
  beforeEach(() => localStorage.clear());

  it("shows total revenue and the affiliate table", async () => {
    const api = createMockApi();
    saveSession({ affiliateId: "admin1", name: "Admin", email: "admin@nutree.app", role: "admin", onboarded: true });
    render(
      <ApiContext.Provider value={api}>
        <ThemeProvider>
          <MemoryRouter><Overview /></MemoryRouter>
        </ThemeProvider>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("$11,030")).toBeInTheDocument()); // 4820+2310+3900
    expect(screen.getByText("Alex R.")).toBeInTheDocument();
    expect(screen.getByText("Sam T.")).toBeInTheDocument();
  });

  it("filters affiliates by search", async () => {
    const api = createMockApi();
    saveSession({ affiliateId: "admin1", name: "Admin", email: "admin@nutree.app", role: "admin", onboarded: true });
    render(
      <ApiContext.Provider value={api}>
        <ThemeProvider>
          <MemoryRouter><Overview /></MemoryRouter>
        </ThemeProvider>
      </ApiContext.Provider>
    );
    await waitFor(() => expect(screen.getByText("Alex R.")).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText(/tìm/i), "Sam");
    expect(screen.queryByText("Alex R.")).not.toBeInTheDocument();
    expect(screen.getByText("Sam T.")).toBeInTheDocument();
  });
});
