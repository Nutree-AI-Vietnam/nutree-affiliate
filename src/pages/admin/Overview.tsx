import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { currency, dateOrDash } from "../../lib/format";
import type { AdminOverview, AffiliateRow } from "../../types";

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
  const [sortKey, setSortKey] = useState<keyof AffiliateRow>("payoutOwed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterPayoutOwed, setFilterPayoutOwed] = useState(false);

  const load = useCallback(() =>
    api.getAdminOverview().then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải")),
  [api]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    let result = data.affiliates.filter(
      (a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
    );
    if (filterPayoutOwed) {
      result = result.filter((a) => a.payoutOwed > 0 && a.hasBankInfo);
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortKey] as number | string | boolean | null;
      const bVal = b[sortKey] as number | string | boolean | null;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [data, query, sortKey, sortDir, filterPayoutOwed]);

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key as keyof AffiliateRow);
      setSortDir("desc");
    }
  };

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
                <div className="flex items-center gap-2">
                  <input
                    className="h-9 w-56 rounded-xl border border-gray-200 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#1F1F1F] px-3 text-sm text-gray-700 dark:text-[#B0B0B0] placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20 transition"
                    placeholder="Tìm affiliate…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    onClick={() => setFilterPayoutOwed((v) => !v)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      filterPayoutOwed
                        ? "border-[#29B6A1] bg-[#29B6A1] text-white"
                        : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-[#29B6A1] hover:text-[#29B6A1]"
                    }`}
                  >
                    Cần thanh toán
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-b-2xl">
                <DataTable
                  rows={rows}
                  rowKey={(r) => r.affiliateId}
                  empty="Không có affiliate"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
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
                    { key: "pendingTrials", header: "Dùng thử", sortable: true },
                    { key: "activeSubscriptions", header: "Đăng ký", sortable: true },
                    { key: "totalRevenue", header: "Doanh thu", sortable: true, render: (r) => currency(r.totalRevenue) },
                    { key: "payoutOwed", header: "Cần trả", sortable: true, render: (r) => currency(r.payoutOwed) },
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
