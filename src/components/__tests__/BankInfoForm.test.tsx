import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BankInfoForm } from "../BankInfoForm";

describe("BankInfoForm", () => {
  it("submits entered values", async () => {
    const onSave = vi.fn();
    render(<BankInfoForm initial={null} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Bank name"), "Chase");
    await userEvent.type(screen.getByLabelText("Account holder"), "Alex Reed");
    await userEvent.type(screen.getByLabelText("Account number / IBAN"), "000123456");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({
      bankName: "Chase", accountHolder: "Alex Reed",
      accountNumber: "000123456", routingOrSwift: "",
    });
  });
});
