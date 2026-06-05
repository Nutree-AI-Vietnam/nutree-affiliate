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
      .catch((e) => { setError(e instanceof Error ? e.message : "Không thể tải"); setLoaded(true); });
  }, [api]);

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-2 text-2xl font-extrabold" style={{ color: "#1A4739" }}>Thông tin ngân hàng</h1>
        <p className="mb-6 text-sm text-gray-500">Thông tin này sẽ được dùng để chuyển hoa hồng cho bạn.</p>
        {!loaded ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            {error && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}
            {saved && (
              <p className="mb-4 rounded-xl bg-[#E6F7F5] px-4 py-2.5 text-sm font-semibold" style={{ color: "#1A4739" }}>
                ✓ Đã lưu thông tin ngân hàng
              </p>
            )}
            <BankInfoForm
              initial={info}
              onSave={async (next) => {
                try {
                  const result = await api.saveBankInfo(next);
                  setInfo(result); setSaved(true); setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Không thể lưu");
                }
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
