import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { QrCode } from "../../components/QrCode";
import type { ReferralInfo } from "../../types";
import { ptLinks } from "./nav";

export function Referral() {
  const api = useApi();
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.getMyReferral().then(setReferral); }, [api]);

  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-extrabold" style={{ color: "#1A4739" }}>Mã giới thiệu của bạn</h1>
        {!referral ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {/* Gradient header */}
            <div
              className="flex flex-col items-center gap-4 p-8"
              style={{ background: "linear-gradient(160deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              <div className="rounded-xl bg-white p-3 shadow-md">
                <QrCode value={referral.link} size={180} />
              </div>
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Mã giới thiệu</div>
                <div className="mt-1 text-3xl font-extrabold tracking-widest text-white">{referral.code}</div>
              </div>
            </div>

            {/* Link section */}
            <div className="p-6">
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>Link chia sẻ</div>
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#F5F5F5] px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-gray-700">{referral.link}</span>
                <button
                  className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                  style={{ background: copied ? "#4CAF50" : "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(referral.link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "✓ Đã sao chép" : "Sao chép"}
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Chia sẻ link này với khách hàng để nhận hoa hồng khi họ đăng ký Nutree AI.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
