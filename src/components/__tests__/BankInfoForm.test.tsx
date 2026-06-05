import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BankInfoForm } from "../BankInfoForm";

describe("BankInfoForm", () => {
  it("submits entered values", async () => {
    const onSave = vi.fn();
    render(<BankInfoForm initial={null} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("Tên ngân hàng"), "Chase");
    await userEvent.type(screen.getByLabelText("Chủ tài khoản"), "Alex Reed");
    await userEvent.type(screen.getByLabelText("Số tài khoản / IBAN"), "000123456");
    await userEvent.click(screen.getByRole("button", { name: /lưu/i }));
    expect(onSave).toHaveBeenCalledWith({
      bankName: "Chase", accountHolder: "Alex Reed",
      accountNumber: "000123456", routingOrSwift: "",
    });
  });
});
