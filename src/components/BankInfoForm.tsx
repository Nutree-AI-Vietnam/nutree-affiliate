import { useState } from "react";
import type { BankInfo } from "../types";

export function BankInfoForm({
  initial, onSave,
}: { initial: BankInfo | null; onSave: (info: BankInfo) => void }) {
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [routingOrSwift, setRoutingOrSwift] = useState(initial?.routingOrSwift ?? "");

  const field = "mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20 transition";
  const label = "block text-sm font-semibold text-[#1A4739]";
  return (
    <form
      className="max-w-md space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ bankName, accountHolder, accountNumber, routingOrSwift });
      }}
    >
      <label className={label}>Tên ngân hàng
        <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} required />
      </label>
      <label className={label}>Chủ tài khoản
        <input className={field} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
      </label>
      <label className={label}>Số tài khoản / IBAN
        <input className={field} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
      </label>
      <label className={label}>Routing / SWIFT <span className="font-normal text-gray-400">(tùy chọn)</span>
        <input className={field} value={routingOrSwift} onChange={(e) => setRoutingOrSwift(e.target.value)} />
      </label>
      <button
        type="submit"
        className="h-11 rounded-xl px-6 font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
        style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
      >
        Lưu thông tin
      </button>
    </form>
  );
}
