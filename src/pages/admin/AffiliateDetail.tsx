// src/pages/admin/AffiliateDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { DataTable } from "../../components/DataTable";
import { currency } from "../../lib/format";
import type { AdminAffiliateDetail } from "../../types";

const adminLinks = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/payouts", label: "Thanh toán" },
];

type Tab = "profile" | "earnings" | "conversions" | "ledger";

export function AffiliateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [detail, setDetail] = useState<AdminAffiliateDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    if (!id) return;
    api.getAdminAffiliateDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải"));
  }, [api, id]);

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-t-xl transition ${
      tab === t
        ? "border-b-2 border-[#29B6A1] text-[#29B6A1]"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
    }`;

  return (
    <div>
      <NavBar title="Admin" links={adminLinks} />
      <main className="mx-auto max-w-5xl p-6">
        <button
          onClick={() => navigate("/admin")}
          className="mb-4 text-sm text-[#29B6A1] hover:underline"
        >
          ← Quay lại
        </button>
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!detail ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{detail.name}</h1>
              <span className="rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1 text-sm font-mono font-semibold text-gray-700 dark:text-gray-300">
                {detail.code}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                detail.status === "active"
                  ? "bg-[#E6F7F5] dark:bg-[#29B6A1]/20 text-[#1A4739] dark:text-[#29B6A1]"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}>
                {detail.status}
              </span>
            </div>

            {/* Tabs */}
            <div className="mb-0 flex gap-1 border-b border-gray-200 dark:border-white/10">
              <button className={tabClass("profile")} onClick={() => setTab("profile")}>Hồ sơ</button>
              <button className={tabClass("earnings")} onClick={() => setTab("earnings")}>Thu nhập</button>
              <button className={tabClass("conversions")} onClick={() => setTab("conversions")}>Chuyển đổi</button>
              <button className={tabClass("ledger")} onClick={() => setTab("ledger")}>Sổ cái</button>
            </div>

            <div className="rounded-b-2xl rounded-tr-2xl bg-white dark:bg-[#2D2D2D] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              {tab === "profile" && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                    Thông tin ngân hàng
                  </div>
                  {detail.bankInfo ? (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div><dt className="text-gray-500 dark:text-gray-400">Ngân hàng</dt><dd className="font-semibold text-gray-900 dark:text-white">{detail.bankInfo.bankName}</dd></div>
                      <div><dt className="text-gray-500 dark:text-gray-400">Chủ tài khoản</dt><dd className="font-semibold text-gray-900 dark:text-white">{detail.bankInfo.accountHolder}</dd></div>
                      <div><dt className="text-gray-500 dark:text-gray-400">Số tài khoản</dt><dd className="font-semibold font-mono text-gray-900 dark:text-white">{detail.bankInfo.accountNumber}</dd></div>
                      {detail.bankInfo.routingOrSwift && (
                        <div><dt className="text-gray-500 dark:text-gray-400">Routing/SWIFT</dt><dd className="font-semibold font-mono text-gray-900 dark:text-white">{detail.bankInfo.routingOrSwift}</dd></div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-gray-400">Chưa có thông tin ngân hàng</p>
                  )}
                </div>
              )}

              {tab === "earnings" && (
                <DataTable
                  rows={detail.monthlyEarnings}
                  rowKey={(m) => m.month}
                  empty="Chưa có dữ liệu thu nhập"
                  columns={[
                    { key: "month", header: "Tháng" },
                    { key: "credits", header: "Hoa hồng", render: (m) => currency(m.credits) },
                    { key: "reversals", header: "Khấu trừ", render: (m) => currency(m.reversals) },
                    { key: "net", header: "Thực nhận", render: (m) => currency(m.net) },
                    {
                      key: "payoutStatus", header: "Trạng thái",
                      render: (m) => {
                        if (m.payoutStatus === "paid") return (
                          <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">
                            ✓ Đã thanh toán
                          </span>
                        );
                        if (m.payoutStatus === "pending") return (
                          <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Chờ xử lý
                          </span>
                        );
                        if (m.payoutStatus === "locked") return (
                          <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            🔒 Mở khoá vào {m.lockedUntil
                              ? new Date(m.lockedUntil).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
                              : "—"}
                          </span>
                        );
                        if (m.payoutStatus === "unrequested") return (
                          <span className="text-xs text-gray-500">Chưa yêu cầu</span>
                        );
                        return <span className="text-xs text-gray-400">Đang tích lũy</span>;
                      },
                    },
                  ]}
                />
              )}

              {tab === "conversions" && (
                <DataTable
                  rows={detail.conversions.map((c, i) => ({ ...c, _idx: i + 1 }))}
                  rowKey={(c) => String(c._idx)}
                  empty="Chưa có chuyển đổi"
                  columns={[
                    { key: "_idx", header: "#" },
                    { key: "joinedAt", header: "Ngày đăng ký" },
                    {
                      key: "status", header: "Trạng thái",
                      render: () => <span className="rounded-full bg-[#E6F7F5] dark:bg-[#29B6A1]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1A4739] dark:text-[#29B6A1]">Đang đăng ký</span>,
                    },
                  ]}
                />
              )}

              {tab === "ledger" && (
                <DataTable
                  rows={detail.ledgerEntries}
                  rowKey={(e) => e.id}
                  empty="Sổ cái trống"
                  columns={[
                    { key: "createdAt", header: "Ngày", render: (e) => e.createdAt.slice(0, 10) },
                    {
                      key: "entryType", header: "Loại",
                      render: (e) => {
                        const colors: Record<string, string> = {
                          credit: "text-green-600 dark:text-green-400",
                          reversal: "text-red-600 dark:text-red-400",
                          payout_deduction: "text-gray-500 dark:text-gray-400",
                        };
                        return <span className={colors[e.entryType] ?? "text-gray-600"}>{e.entryType}</span>;
                      },
                    },
                    { key: "amount", header: "Số tiền", render: (e) => currency(e.amount) },
                    { key: "note", header: "Ghi chú", render: (e) => e.note ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
