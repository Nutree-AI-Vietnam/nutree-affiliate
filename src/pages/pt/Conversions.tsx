// src/pages/pt/Conversions.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { ptLinks } from "./nav";
import type { Conversion } from "../../types";

export function Conversions() {
  const api = useApi();
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyConversions()
      .then(setConversions)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {loading ? (
          <p className="text-gray-400 text-sm">Đang tải…</p>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
              Người dùng đã chuyển đổi
            </div>
            <DataTable
              rows={conversions.map((c, i) => ({ ...c, _idx: i + 1 }) as Conversion & { _idx: number })}
              rowKey={(c) => String(c._idx)}
              empty="Chia sẻ mã của bạn để bắt đầu"
              columns={[
                { key: "_idx", header: "#" },
                { key: "joinedAt", header: "Ngày đăng ký" },
                {
                  key: "status", header: "Trạng thái",
                  render: () => (
                    <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">
                      Đang đăng ký
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
}
