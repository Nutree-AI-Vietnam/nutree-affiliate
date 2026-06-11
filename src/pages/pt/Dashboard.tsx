import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { QrCode } from "../../components/QrCode";
import { currency, dateOrDash } from "../../lib/format";
import { getNeonAuthToken } from "../../lib/neon-auth";
import type { MyStats, ReferralInfo, Payout, MonthlyEarning } from "../../types";
import { ptLinks } from "./nav";

export function Dashboard() {
  const api = useApi();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState("");
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);
  const [requestingMonth, setRequestingMonth] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  // Edit-code state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.getMyStats(), api.getMyReferral(), api.getMyPayouts(), api.getMyMonthlyEarnings()])
      .then(([s, r, p, m]) => { setStats(s); setReferral(r); setPayouts(p); setMonthlyEarnings(m); })
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"));
  }, [api]);

  const startEdit = () => {
    setDraft(referral?.code ?? "");
    setCodeError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const submitPayoutRequest = async (month: string) => {
    setRequestLoading(true);
    setRequestError(null);
    try {
      const result = await api.requestPayout(month);
      setMonthlyEarnings((prev) =>
        prev.map((m) => m.month === result.period
          ? { ...m, payoutStatus: "pending" as const, payoutRequestId: result.id }
          : m
        )
      );
      setRequestingMonth(null);
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setRequestLoading(false);
    }
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
            </div>

            {monthlyEarnings.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                  Thu nhập theo tháng
                </div>
                <DataTable
                  rows={monthlyEarnings}
                  rowKey={(m) => m.month}
                  empty=""
                  columns={[
                    { key: "month", header: "Tháng" },
                    { key: "credits", header: "Hoa hồng", render: (m) => currency(m.credits) },
                    { key: "reversals", header: "Khấu trừ", render: (m) => currency(m.reversals) },
                    { key: "net", header: "Thực nhận", render: (m) => currency(m.net) },
                    {
                      key: "payoutStatus", header: "Trạng thái",
                      render: (m) => {
                        if (m.payoutStatus === "paid") return <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">✓ Đã thanh toán</span>;
                        if (m.payoutStatus === "pending") return <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Chờ xử lý</span>;
                        if (m.payoutStatus === "accumulating") return <span className="text-xs text-gray-400">Đang tích lũy</span>;
                        return null;
                      },
                    },
                    {
                      key: "action", header: "",
                      render: (m) => m.payoutStatus === "unrequested"
                        ? (
                          <button
                            onClick={() => { setRequestingMonth(m.month); setRequestError(null); }}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-80 active:scale-95"
                            style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                          >
                            Yêu cầu thanh toán
                          </button>
                        )
                        : null,
                    },
                  ]}
                />
              </div>
            )}

            {/* Payout request modal */}
            {requestingMonth && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#2D2D2D] p-6 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
                  <div className="mb-1 text-base font-bold text-gray-900 dark:text-white">Yêu cầu thanh toán</div>
                  <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                    Tháng: <span className="font-semibold text-gray-800 dark:text-white">{requestingMonth}</span>
                    {" · "}
                    Số tiền: <span className="font-semibold text-gray-800 dark:text-white">
                      {currency(monthlyEarnings.find((m) => m.month === requestingMonth)?.net ?? 0)}
                    </span>
                  </div>
                  {requestError && <p className="mb-3 text-xs text-red-500">{requestError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitPayoutRequest(requestingMonth)}
                      disabled={requestLoading}
                      className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                    >
                      {requestLoading ? "Đang gửi…" : "Xác nhận"}
                    </button>
                    <button
                      onClick={() => { setRequestingMonth(null); setRequestError(null); }}
                      className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
