import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { currency, dateOrDash } from "../../lib/format";
import type { AdminOverview } from "../../types";

const adminLinks = [{ to: "/admin", label: "Tổng quan" }];

export function Overview() {
  const api = useApi();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() =>
    api.getAdminOverview().then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load")),
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
      <NavBar title="Nutree Affiliates — Admin" links={adminLinks} />
      <main className="mx-auto max-w-6xl p-6">
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
        {!data ? <p className="text-gray-500">Đang tải…</p> : (
          <>
            <div className="mb-5 rounded-2xl bg-gradient-to-r from-green-700 to-green-600 p-6 text-white shadow-lg">
              <div className="text-xs font-semibold uppercase tracking-widest text-green-200">Tổng doanh thu (tất cả affiliate)</div>
              <div className="mt-1 text-4xl font-extrabold">{currency(data.totalRevenue)}</div>
              <div className="mt-2 text-sm text-green-200">
                Tổng cần thanh toán: <span className="font-semibold text-white">{currency(data.totalPayoutOwed)}</span> · {data.activeAffiliates} affiliate đang hoạt động
              </div>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <StatCard label="Đang dùng thử" value={String(data.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(data.activeSubscriptions)} />
              <StatCard label="Hoa hồng / chuyển đổi" value={currency(data.commissionPerConversion)} />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest text-green-600">Affiliates</div>
                <input
                  className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
                  placeholder="Tìm affiliate…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DataTable
                rows={rows}
                rowKey={(r) => r.affiliateId}
                empty="Không có affiliate"
                columns={[
                  { key: "name", header: "Tên" },
                  { key: "code", header: "Mã" },
                  { key: "pendingTrials", header: "Dùng thử" },
                  { key: "activeSubscriptions", header: "Đăng ký" },
                  { key: "totalRevenue", header: "Doanh thu", render: (r) => currency(r.totalRevenue) },
                  { key: "payoutOwed", header: "Cần trả", render: (r) => currency(r.payoutOwed) },
                  { key: "hasBankInfo", header: "Thông tin NH", render: (r) => (r.hasBankInfo ? "OK" : "Thiếu") },
                  { key: "lastPaidDate", header: "Lần trả cuối", render: (r) => dateOrDash(r.lastPaidDate) },
                  {
                    key: "action", header: "",
                    render: (r) => (
                      <button
                        className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                        onClick={async () => { await api.markPayoutPaid(r.affiliateId); await load(); }}>
                        Đánh dấu đã trả
                      </button>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
