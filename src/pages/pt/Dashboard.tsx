import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { QrCode } from "../../components/QrCode";
import { currency, dateOrDash } from "../../lib/format";
import { getNeonAuthToken } from "../../lib/neon-auth";
import type { MyStats, ReferralInfo, Payout } from "../../types";
import { ptLinks } from "./nav";

export function Dashboard() {
  const api = useApi();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState("");

  // Edit-code state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.getMyStats(), api.getMyReferral(), api.getMyPayouts()])
      .then(([s, r, p]) => { setStats(s); setReferral(r); setPayouts(p); })
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"));
  }, [api]);

  const startEdit = () => {
    setDraft(referral?.code ?? "");
    setCodeError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const saveCode = async () => {
    const trimmed = draft.trim().toUpperCase();
    if (!trimmed) { setCodeError("Vui lòng nhập mã"); return; }
    if (trimmed.length > 8) { setCodeError("Tối đa 8 ký tự"); return; }
    if (!/^[A-Z0-9]+$/.test(trimmed)) { setCodeError("Chỉ dùng chữ cái và số"); return; }

    setSaving(true);
    setCodeError(null);
    try {
      const token = await getNeonAuthToken();
      const res = await fetch("/api/affiliate/referral-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { code?: string; error?: string };
      if (!res.ok) { setCodeError(data.error ?? "Lỗi không xác định"); return; }
      setReferral((r) => r ? { ...r, code: data.code! } : r);
      setEditing(false);
    } catch {
      setCodeError("Lỗi kết nối, thử lại sau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!stats ? (
          <p className="text-gray-400 text-sm">Đang tải…</p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Tổng doanh thu" value={currency(stats.totalRevenue)} />
              <StatCard label="Tổng thanh toán" value={currency(stats.totalPayout)} />
              <StatCard label="Đang dùng thử" value={String(stats.pendingTrials)} />
              <StatCard label="Đang đăng ký" value={String(stats.activeSubscriptions)} />
              <StatCard label="Lần trả gần nhất" value={dateOrDash(stats.lastPaymentDate)} />
            </div>

            {referral && (
              <div
                className="mb-6 flex items-center gap-5 rounded-2xl p-5 text-white shadow-md"
                style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
              >
                <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm ring-1 ring-white/20 flex-shrink-0">
                  <QrCode value={referral.link} size={80} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Mã giới thiệu của bạn</div>
                  {editing ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                        maxLength={8}
                        className="w-36 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-lg font-extrabold tracking-widest text-white placeholder-white/40 focus:border-white focus:outline-none"
                        placeholder="TỐI ĐA 8"
                        onKeyDown={(e) => { if (e.key === "Enter") saveCode(); if (e.key === "Escape") setEditing(false); }}
                      />
                      {codeError && <p className="text-xs text-red-300">{codeError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={saveCode}
                          disabled={saving}
                          className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-[#1A4739] hover:opacity-90 disabled:opacity-50"
                        >
                          {saving ? "Đang lưu…" : "Lưu"}
                        </button>
                        <button
                          onClick={() => { setEditing(false); setCodeError(null); }}
                          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="text-2xl font-extrabold tracking-wide">{referral.code}</div>
                      <button
                        onClick={startEdit}
                        title="Đổi mã"
                        className="rounded-md bg-white/10 p-1 text-white/60 hover:bg-white/20 hover:text-white transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="mt-1 font-mono text-xs text-white/70 truncate">{referral.link}</div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
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
                      ? <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">Đã trả</span>
                      : <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Chờ xử lý</span>
                  },
                  { key: "paidDate", header: "Ngày trả", render: (p) => dateOrDash(p.paidDate) },
                ]}
              />
              <div className="mt-3 text-right px-1">
                <a
                  href="/pt/earnings"
                  className="text-xs font-medium text-[#29B6A1] hover:underline"
                >
                  Xem thu nhập theo tháng →
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
