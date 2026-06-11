// src/pages/admin/PayoutQueue.tsx
import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { currency } from "../../lib/format";
import type { AdminPayoutRequest } from "../../types";

const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];

export function PayoutQueue() {
  const api = useApi();
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const load = useCallback(() =>
    api.getAdminPayoutRequests()
      .then(setRequests)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải")),
  [api]);

  useEffect(() => { load(); }, [load]);

  const pending = requests.filter((r) => r.status === "pending");
  const completed = requests.filter((r) => r.status === "paid");

  const handleApprove = async (requestId: string) => {
    setApproveLoading(true);
    setApproveError(null);
    try {
      await api.approvePayoutRequest(requestId, approveNote || undefined);
      setApproving(null);
      setApproveNote("");
      await load();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setApproveLoading(false);
    }
  };

  const approvingRequest = approving ? requests.find((r) => r.id === approving) : null;

  return (
    <div>
      <NavBar title="Admin" links={adminLinks} />
      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Summary banner */}
        {pending.length > 0 && (
          <div
            className="mb-6 rounded-2xl p-4 text-white shadow-md flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
          >
            <div className="text-sm font-semibold">
              {pending.length} yêu cầu đang chờ xử lý
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/60 uppercase tracking-widest">Tổng cần trả</div>
              <div className="text-xl font-extrabold">{currency(pending.reduce((s, r) => s + r.amount, 0))}</div>
            </div>
          </div>
        )}

        {/* Pending section */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
            Chờ xử lý ({pending.length})
          </div>
          <DataTable
            rows={pending}
            rowKey={(r) => r.id}
            empty="Không có yêu cầu đang chờ"
            columns={[
              { key: "affiliateName", header: "Affiliate" },
              { key: "period", header: "Tháng" },
              { key: "amount", header: "Số tiền", render: (r) => currency(r.amount) },
              { key: "requestedAt", header: "Yêu cầu lúc", render: (r) => r.requestedAt.slice(0, 10) },
              {
                key: "action", header: "",
                render: (r) => (
                  <button
                    onClick={() => { setApproving(r.id); setApproveNote(""); setApproveError(null); }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-80 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                  >
                    Duyệt & Trả
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Completed section */}
        <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Đã hoàn thành
          </div>
          <DataTable
            rows={completed}
            rowKey={(r) => r.id}
            empty="Chưa có thanh toán nào"
            columns={[
              { key: "affiliateName", header: "Affiliate" },
              { key: "period", header: "Tháng" },
              { key: "amount", header: "Số tiền", render: (r) => currency(r.amount) },
              { key: "completedAt", header: "Ngày trả", render: (r) => r.completedAt?.slice(0, 10) ?? "—" },
              { key: "adminNote", header: "Ghi chú", render: (r) => r.adminNote ?? "—" },
            ]}
          />
        </div>

        {/* Approve modal */}
        {approving && approvingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#2D2D2D] p-6 shadow-xl ring-1 ring-black/10 dark:ring-white/10">
              <div className="mb-1 text-base font-bold text-gray-900 dark:text-white">Duyệt thanh toán</div>
              <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-white">{approvingRequest.affiliateName}</span>
                {" · "}Tháng <span className="font-semibold text-gray-800 dark:text-white">{approvingRequest.period}</span>
                {" · "}<span className="font-semibold text-gray-800 dark:text-white">{currency(approvingRequest.amount)}</span>
              </div>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                rows={2}
                className="mb-3 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-[#F5F5F5] dark:bg-[#1F1F1F] px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-[#29B6A1] focus:outline-none"
              />
              {approveError && <p className="mb-3 text-xs text-red-500">{approveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(approving)}
                  disabled={approveLoading}
                  className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                >
                  {approveLoading ? "Đang xử lý…" : "Xác nhận thanh toán"}
                </button>
                <button
                  onClick={() => setApproving(null)}
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
