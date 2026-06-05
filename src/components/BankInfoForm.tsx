import { useState } from "react";
import type { BankInfo } from "../types";

export function BankInfoForm({
  initial, onSave,
}: { initial: BankInfo | null; onSave: (info: BankInfo) => void }) {
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [routingOrSwift, setRoutingOrSwift] = useState(initial?.routingOrSwift ?? "");

  const field = "mt-1 w-full rounded border border-gray-300 px-3 py-2";
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ bankName, accountHolder, accountNumber, routingOrSwift });
      }}
    >
      <label className="block text-sm">Bank name
        <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} required />
      </label>
      <label className="block text-sm">Account holder
        <input className={field} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required />
      </label>
      <label className="block text-sm">Account number / IBAN
        <input className={field} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
      </label>
      <label className="block text-sm">Routing / SWIFT (optional)
        <input className={field} value={routingOrSwift} onChange={(e) => setRoutingOrSwift(e.target.value)} />
      </label>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save</button>
    </form>
  );
}
