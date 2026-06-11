// src/pages/pt/Earnings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { currency } from "../../lib/format";
import type { MonthlyEarning } from "../../types";
import { ptLinks } from "./nav";

export function Earnings() {
  const api = useApi();
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState<MonthlyEarning[]>([]);
  const [error, setError] = useState("");
  const [requestingMonth, setRequestingMonth] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    api.getMyMonthlyEarnings()
      .then(setEarnings)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu"));
  }, [api]);

  const totalEarned = earnings.reduce((s, m) => s + Math.max(0, m.net), 0);
  const totalPaid = earnings
    .filter((m) => m.payoutStatus === "paid")
    .reduce((s, m) => s + Math.max(0, m.net), 0);
  const availableToRequest = earnings
    .filter((m) => m.payoutStatus === "unrequested")
    .reduce((s, m) => s + Math.max(0, m.net), 0);

  const submitPayoutRequest = async (month: string) => {
    setRequestLoading(true);
    setRequestError(null);
    try {
      const result = await api.requestPayout(month);
      setEarnings((prev) =>
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

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-4xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Summary bar */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Tổng kiếm được</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">{currency(totalEarned)}</div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Đã nhận</div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">{currency(totalPaid)}</div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm text-center ring-1 ring-transparent" style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Có thể rút</div>
            <div className="text-xl font-extrabold text-white">{currency(availableToRequest)}</div>
          </div>
        </div>

        {!earnings.length ? (
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-10 shadow-sm ring-1 ring-black/5 dark:ring-white/10 text-center">
            <div className="text-2xl mb-2">🌱</div>
            <p className="text-sm text-gray-400">Chưa có dữ liệu thu nhập</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                Thu nhập theo tháng
              </div>
              <button
                onClick={() => navigate("/pt")}
                className="text-xs text-gray-400 hover:text-[#29B6A1] transition"
              >
                ← Tổng quan
              </button>
            </div>
            <div className="overflow-x-auto rounded-b-2xl">
              <DataTable
                rows={earnings}
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
                      return <span className="text-xs text-gray-500">Chưa yêu cầu</span>;
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
                  {currency(earnings.find((m) => m.month === requestingMonth)?.net ?? 0)}
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
      </main>
    </div>
  );
}
