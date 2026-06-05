import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { QrCode } from "../../components/QrCode";
import { currency, dateOrDash } from "../../lib/format";
import type { MyStats, ReferralInfo, Payout } from "../../types";
import { ptLinks } from "./nav";

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
        {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
        {!stats ? <p className="text-gray-500">Loading…</p> : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Tổng doanh thu" value={currency(stats.totalRevenue)} />
              <StatCard label="Tổng thanh toán" value={currency(stats.totalPayout)} />
              <StatCard label="Đang dùng thử" value={String(stats.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(stats.activeSubscriptions)} />
              <StatCard label="Lần trả gần nhất" value={dateOrDash(stats.lastPaymentDate)} />
            </div>
            {referral && (
              <div className="mb-6 flex items-center gap-5 rounded-xl border border-green-100 bg-green-50 p-5">
                <QrCode value={referral.link} size={90} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-green-600">Mã giới thiệu của bạn</div>
                  <div className="text-lg font-extrabold text-gray-900">{referral.code}</div>
                  <div className="mt-1 font-mono text-sm">{referral.link}</div>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-green-600">Lịch sử thanh toán</div>
              <DataTable
                rows={payouts}
                rowKey={(p) => p.period}
                empty="Chia sẻ link của bạn để bắt đầu kiếm tiền"
                columns={[
                  { key: "period", header: "Kỳ" },
                  { key: "conversions", header: "Chuyển đổi" },
                  { key: "amount", header: "Số tiền", render: (p) => currency(p.amount) },
                  { key: "status", header: "Trạng thái", render: (p) => (p.status === "paid" ? "Đã trả" : "Chờ xử lý") },
                  { key: "paidDate", header: "Ngày trả", render: (p) => dateOrDash(p.paidDate) },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
