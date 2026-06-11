import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { QrCode } from "../../components/QrCode";
import { getNeonAuthToken } from "../../lib/neon-auth";
import type { ReferralInfo } from "../../types";
import { ptLinks } from "./nav";

export function Referral() {
  const api = useApi();
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit-code state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.getMyReferral().then(setReferral); }, [api]);

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
      const res = await fetch("/api/affiliate/referral-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getNeonAuthToken()}` },
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
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-extrabold text-[#1A4739] dark:text-white">Mã giới thiệu của bạn</h1>
        {!referral ? (
          <p className="text-sm text-gray-400">Đang tải…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            {/* Hero */}
            <div
              className="flex flex-col items-center gap-4 p-8"
              style={{ background: "linear-gradient(160deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              <div className="rounded-xl bg-white p-3 shadow-md">
                <QrCode value={referral.link} size={180} />
              </div>
              <div className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Mã giới thiệu</div>
                {editing ? (
                  <div className="mt-2 flex flex-col items-center gap-2">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                      maxLength={8}
                      className="w-40 rounded-xl border-2 border-white/40 bg-white/10 px-4 py-2 text-center text-2xl font-extrabold tracking-widest text-white placeholder-white/40 focus:border-white focus:outline-none"
                      placeholder="TỐI ĐA 8"
                      onKeyDown={(e) => { if (e.key === "Enter") saveCode(); if (e.key === "Escape") setEditing(false); }}
                    />
                    {codeError && <p className="text-xs text-red-300">{codeError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={saveCode}
                        disabled={saving}
                        className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-[#1A4739] transition hover:opacity-90 disabled:opacity-50"
                      >
                        {saving ? "Đang lưu…" : "Lưu"}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setCodeError(null); }}
                        className="rounded-xl bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/20"
                      >
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3 justify-center">
                    <div className="text-3xl font-extrabold tracking-widest text-white">{referral.code}</div>
                    <button
                      onClick={startEdit}
                      title="Đổi mã"
                      className="rounded-lg bg-white/10 p-1.5 text-white/70 hover:bg-white/20 hover:text-white transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Link share */}
            <div className="p-6">
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#29B6A1" }}>Link chia sẻ</div>
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#F5F5F5] dark:bg-[#1F1F1F] px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-gray-700 dark:text-[#B0B0B0]">{referral.link}</span>
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
              <p className="mt-3 text-sm text-gray-500 dark:text-[#B0B0B0]">
                Chia sẻ link này với khách hàng để nhận hoa hồng khi họ đăng ký Nutree.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
