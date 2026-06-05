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
        {error && <p className="text-red-600">{error}</p>}
        {!data ? <p className="text-gray-500">Đang tải…</p> : (
          <>
            <div className="mb-4 rounded-xl bg-black p-5 text-white">
              <div className="text-xs uppercase text-gray-300">Tổng doanh thu (tất cả affiliate)</div>
              <div className="text-3xl font-extrabold">{currency(data.totalRevenue)}</div>
              <div className="mt-1 text-sm text-gray-300">
                Tổng cần thanh toán: {currency(data.totalPayoutOwed)} · {data.activeAffiliates} affiliate đang hoạt động
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <StatCard label="Đang dùng thử" value={String(data.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(data.activeSubscriptions)} />
              <StatCard label="Hoa hồng / chuyển đổi" value={currency(data.commissionPerConversion)} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-gray-500">Affiliates</div>
                <input
                  className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
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
                        className="rounded bg-black px-2 py-1 text-xs text-white"
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
