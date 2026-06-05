import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { BankInfoForm } from "../../components/BankInfoForm";
import type { BankInfo as BankInfoType } from "../../types";
import { ptLinks } from "./nav";

export function BankInfo() {
  const api = useApi();
  const [info, setInfo] = useState<BankInfoType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMyBankInfo()
      .then((i) => { setInfo(i); setLoaded(true); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Failed to load"); setLoaded(true); });
  }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-extrabold text-gray-900">Thông tin ngân hàng</h1>
        {!loaded ? <p className="text-gray-500">Đang tải…</p> : (
          <>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
            {saved && <p className="mb-4 rounded-lg bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">Đã lưu.</p>}
            <BankInfoForm
              initial={info}
              onSave={async (next) => {
                try {
                  const result = await api.saveBankInfo(next);
                  setInfo(result); setSaved(true); setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save");
                }
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
