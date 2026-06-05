import { useState } from "react";
import type { BankInfo } from "../types";

export function BankInfoForm({
  initial, onSave,
}: { initial: BankInfo | null; onSave: (info: BankInfo) => void }) {
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [routingOrSwift, setRoutingOrSwift] = useState(initial?.routingOrSwift ?? "");

  const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition";
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ bankName, accountHolder, accountNumber, routingOrSwift });
      }}
    >
      <label className="block text-sm font-medium text-gray-700">Tên ngân hàng
        <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-gray-700">Chủ tài khoản
        <input className={field} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-gray-700">Số tài khoản / IBAN
        <input className={field} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
      </label>
      <label className="block text-sm font-medium text-gray-700">Routing / SWIFT (tùy chọn)
        <input className={field} value={routingOrSwift} onChange={(e) => setRoutingOrSwift(e.target.value)} />
      </label>
      <button type="submit" className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 transition-colors">Lưu</button>
    </form>
  );
}
