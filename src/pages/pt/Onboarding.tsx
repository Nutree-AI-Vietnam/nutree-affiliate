import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { loadSession, saveSession } from "../../auth/session";

export function Onboarding() {
  const navigate = useNavigate();
  const session = loadSession();

  const [name, setName] = useState(session?.name ?? "");
  const [code, setCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    if (!name.trim()) { setError("Vui lòng nhập họ tên"); return; }
    if (!trimmedCode) { setError("Vui lòng nhập mã giới thiệu"); return; }
    if (trimmedCode.length > 8 || !/^[A-Z0-9]+$/.test(trimmedCode)) {
      setError("Mã tối đa 8 ký tự, chỉ dùng chữ và số"); return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const bankInfo = bankName.trim()
        ? { bankName: bankName.trim(), accountHolder: accountHolder.trim(), accountNumber: accountNumber.trim() }
        : undefined;

      const res = await fetch("/api/affiliate/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), referralCode: trimmedCode, bankInfo }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Lỗi không xác định"); return; }

      // Update local session
      if (session) {
        saveSession({ ...session, name: name.trim(), onboarded: true });
      }
      navigate("/pt", { replace: true });
    } catch {
      setError("Lỗi kết nối, thử lại sau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] dark:bg-[#1A1A1A] flex flex-col">
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center gap-3"
        style={{ background: "linear-gradient(160deg, #1A4739 0%, #29B6A1 100%)" }}
      >
        <img src="/logo-icon.png" alt="Nutree AI" className="h-9 w-9 rounded-xl object-cover" />
        <div>
          <div className="font-extrabold text-white">
            Nutree <span style={{ color: "#7FE0D2" }}>AI</span>
          </div>
          <div className="text-[10px] text-white/60 font-medium tracking-widest uppercase">Affiliate</div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold text-[#1A4739] dark:text-white mb-1">Tạo hồ sơ của bạn</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Chỉ mất 1 phút — điền xong là bắt đầu kiếm tiền ngay.</p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10 p-5 space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                Thông tin cá nhân
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1F1F1F] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20"
                />
              </div>

              {/* Referral code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mã giới thiệu của bạn <span className="text-red-500">*</span>
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                  placeholder="VD: MINHTU"
                  maxLength={8}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1F1F1F] px-4 py-2.5 text-sm font-mono tracking-widest text-gray-900 dark:text-white focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20"
                />
                <p className="mt-1.5 text-xs text-gray-400">Tối đa 8 ký tự, chỉ dùng chữ cái và số. Khách dùng mã này để được giảm 20%.</p>
              </div>
            </div>

            {/* Bank info (optional) */}
            <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>
                  Thông tin ngân hàng
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">Không bắt buộc</span>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Điền để nhận thanh toán vào ngày 5 hàng tháng. Có thể cập nhật sau.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tên ngân hàng</label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="VD: Vietcombank"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1F1F1F] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20"
                />
              </div>
              {bankName.trim() && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chủ tài khoản</label>
                    <input
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="NGUYEN VAN A"
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1F1F1F] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Số tài khoản</label>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="0123456789"
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1F1F1F] px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20"
                    />
                  </div>
                </>
              )}
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl py-3.5 text-base font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              {saving ? "Đang tạo hồ sơ…" : "Bắt đầu →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
