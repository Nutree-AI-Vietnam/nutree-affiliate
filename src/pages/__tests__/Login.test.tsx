import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ApiContext } from "../../api";
import { createMockApi } from "../../api/mockApi";
import { Login } from "../Login";

function setup() {
  return render(
    <ApiContext.Provider value={createMockApi()}>
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
  it("logs in a PT and navigates to the PT dashboard", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), "alex@pt.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("pt dashboard")).toBeInTheDocument());
  });

  it("shows an error on bad credentials", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), "alex@pt.com");
    await userEvent.type(screen.getByLabelText(/password/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/invalid/i)).toBeInTheDocument());
  });
});
