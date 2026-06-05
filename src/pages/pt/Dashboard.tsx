import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { QrCode } from "../../components/QrCode";
import { currency, dateOrDash } from "../../lib/format";
import type { MyStats, ReferralInfo, Payout } from "../../types";

const ptLinks = [
  { to: "/pt", label: "Dashboard" },
  { to: "/pt/referral", label: "My Code" },
  { to: "/pt/bank", label: "Bank Info" },
];

export function Dashboard() {
  const api = useApi();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getMyStats(), api.getMyReferral(), api.getMyPayouts()])
      .then(([s, r, p]) => { setStats(s); setReferral(r); setPayouts(p); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && <p className="text-red-600">{error}</p>}
        {!stats ? <p className="text-gray-500">Loading…</p> : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Total Revenue" value={currency(stats.totalRevenue)} />
              <StatCard label="Total Payout" value={currency(stats.totalPayout)} />
              <StatCard label="Pending Trials" value={String(stats.pendingTrials)} />
              <StatCard label="Active Subs" value={String(stats.activeSubscriptions)} />
              <StatCard label="Last Payment" value={dateOrDash(stats.lastPaymentDate)} />
            </div>
            {referral && (
              <div className="mb-6 flex items-center gap-5 rounded-xl border border-gray-200 bg-white p-4">
                <QrCode value={referral.link} size={90} />
                <div>
                  <div className="text-xs uppercase text-gray-500">Your referral code</div>
                  <div className="text-lg font-bold">{referral.code}</div>
                  <div className="mt-1 font-mono text-sm">{referral.link}</div>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-xs uppercase text-gray-500">Payout history</div>
              <DataTable
                rows={payouts}
                rowKey={(p) => p.period}
                empty="Share your link to start earning"
                columns={[
                  { key: "period", header: "Period" },
                  { key: "conversions", header: "Conversions" },
                  { key: "amount", header: "Amount", render: (p) => currency(p.amount) },
                  { key: "status", header: "Status", render: (p) => (p.status === "paid" ? "Paid" : "Pending") },
                  { key: "paidDate", header: "Paid date", render: (p) => dateOrDash(p.paidDate) },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
