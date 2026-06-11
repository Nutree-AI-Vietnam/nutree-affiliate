import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { currency, dateOrDash } from "../../lib/format";
import type { AdminOverview } from "../../types";

const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];

export function Overview() {
  const api = useApi();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() =>
    api.getAdminOverview().then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải")),
  [api]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    return data.affiliates.filter(
      (a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div>
      <NavBar title="Admin" links={adminLinks} />
      <main className="mx-auto max-w-6xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!data ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <>
            <div
              className="mb-6 rounded-2xl p-6 text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                Tổng doanh thu (tất cả affiliate)
              </div>
              <div className="mt-1 text-4xl font-extrabold">{currency(data.totalRevenue)}</div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-white/70">
                <span>Cần thanh toán: <span className="font-bold text-white">{currency(data.totalPayoutOwed)}</span></span>
                <span>·</span>
                <span><span className="font-bold text-white">{data.activeAffiliates}</span> affiliate đang hoạt động</span>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              <StatCard label="Đang dùng thử" value={String(data.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(data.activeSubscriptions)} />
              <StatCard label="Hoa hồng / chuyển đổi" value={currency(data.commissionPerConversion)} />
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                  Danh sách Affiliates
                </div>
                <input
                  className="h-9 w-56 rounded-xl border border-gray-200 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#1F1F1F] px-3 text-sm text-gray-700 dark:text-[#B0B0B0] placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20 transition"
                  placeholder="Tìm affiliate…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto rounded-b-2xl">
                <DataTable
                  rows={rows}
                  rowKey={(r) => r.affiliateId}
                  empty="Không có affiliate"
                  columns={[
                    { key: "name", header: "Tên", render: (r) => (
                      <button
                        onClick={() => navigate(`/admin/affiliates/${r.affiliateId}`)}
                        className="font-medium text-[#29B6A1] hover:underline"
                      >
                        {r.name}
                      </button>
                    )},
                    { key: "code", header: "Mã" },
                    { key: "pendingTrials", header: "Dùng thử" },
                    { key: "activeSubscriptions", header: "Đăng ký" },
                    { key: "totalRevenue", header: "Doanh thu", render: (r) => currency(r.totalRevenue) },
                    { key: "payoutOwed", header: "Cần trả", render: (r) => currency(r.payoutOwed) },
                    {
                      key: "hasBankInfo", header: "Thông tin NH",
                      render: (r) => r.hasBankInfo
                        ? <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">OK</span>
                        : <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Thiếu</span>
                    },
                    { key: "lastPaidDate", header: "Lần trả cuối", render: (r) => dateOrDash(r.lastPaidDate) },
                  ]}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
