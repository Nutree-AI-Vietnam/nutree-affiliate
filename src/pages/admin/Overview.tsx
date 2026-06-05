import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { currency, dateOrDash } from "../../lib/format";
import type { AdminOverview } from "../../types";

const adminLinks = [{ to: "/admin", label: "Overview" }];

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
        {!data ? <p className="text-gray-500">Loading…</p> : (
          <>
            <div className="mb-4 rounded-xl bg-black p-5 text-white">
              <div className="text-xs uppercase text-gray-300">Total Revenue (all affiliates)</div>
              <div className="text-3xl font-extrabold">{currency(data.totalRevenue)}</div>
              <div className="mt-1 text-sm text-gray-300">
                Total payout owed: {currency(data.totalPayoutOwed)} · {data.activeAffiliates} active affiliates
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <StatCard label="Pending Trials" value={String(data.pendingTrials)} />
              <StatCard label="Active Subscriptions" value={String(data.activeSubscriptions)} />
              <StatCard label="Commission / conversion" value={currency(data.commissionPerConversion)} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-gray-500">Affiliates</div>
                <input
                  className="w-56 rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Search affiliate…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DataTable
                rows={rows}
                rowKey={(r) => r.affiliateId}
                empty="No affiliates"
                columns={[
                  { key: "name", header: "Name" },
                  { key: "code", header: "Code" },
                  { key: "pendingTrials", header: "Pending" },
                  { key: "activeSubscriptions", header: "Active" },
                  { key: "totalRevenue", header: "Revenue", render: (r) => currency(r.totalRevenue) },
                  { key: "payoutOwed", header: "Payout owed", render: (r) => currency(r.payoutOwed) },
                  { key: "hasBankInfo", header: "Bank info", render: (r) => (r.hasBankInfo ? "OK" : "Missing") },
                  { key: "lastPaidDate", header: "Last paid", render: (r) => dateOrDash(r.lastPaidDate) },
                  {
                    key: "action", header: "",
                    render: (r) => (
                      <button
                        className="rounded bg-black px-2 py-1 text-xs text-white"
                        onClick={async () => { await api.markPayoutPaid(r.affiliateId); await load(); }}>
                        Mark paid
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
