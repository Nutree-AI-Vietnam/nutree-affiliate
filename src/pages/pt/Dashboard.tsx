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
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"));
  }, [api]);

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}
        {!stats ? (
          <p className="text-gray-400 text-sm">Đang tải…</p>
        ) : (
          <>
            {/* Stats grid */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Tổng doanh thu" value={currency(stats.totalRevenue)} />
              <StatCard label="Tổng thanh toán" value={currency(stats.totalPayout)} />
              <StatCard label="Đang dùng thử" value={String(stats.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(stats.activeSubscriptions)} />
              <StatCard label="Lần trả gần nhất" value={dateOrDash(stats.lastPaymentDate)} />
            </div>

            {/* Referral card */}
            {referral && (
              <div
                className="mb-6 flex items-center gap-5 rounded-2xl p-5 text-white shadow-md"
                style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
              >
                <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm ring-1 ring-white/20">
                  <QrCode value={referral.link} size={80} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Mã giới thiệu của bạn</div>
                  <div className="mt-0.5 text-2xl font-extrabold tracking-wide">{referral.code}</div>
                  <div className="mt-1 font-mono text-xs text-white/70">{referral.link}</div>
                </div>
              </div>
            )}

            {/* Payout history */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                Lịch sử thanh toán
              </div>
              <DataTable
                rows={payouts}
                rowKey={(p) => p.period}
                empty="Chia sẻ link của bạn để bắt đầu kiếm tiền"
                columns={[
                  { key: "period", header: "Kỳ" },
                  { key: "conversions", header: "Chuyển đổi" },
                  { key: "amount", header: "Số tiền", render: (p) => currency(p.amount) },
                  {
                    key: "status", header: "Trạng thái", render: (p) => p.status === "paid"
                      ? <span className="rounded-full bg-[#E6F7F5] px-2.5 py-0.5 text-xs font-semibold text-[#1A4739]">Đã trả</span>
                      : <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Chờ xử lý</span>
                  },
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
