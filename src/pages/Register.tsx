import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api";
import { saveSession } from "../auth/session";

export function Register() {
  const api = useApi();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const session = await api.register({ name, email, password });
      saveSession(session);
      navigate("/pt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] px-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#29B6A1] focus:outline-none focus:ring-2 focus:ring-[#29B6A1]/20 transition";
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden w-1/2 flex-col items-center justify-center p-12 text-white lg:flex"
        style={{ background: "linear-gradient(160deg, #1A4739 0%, #29B6A1 100%)" }}
      >
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
          <span className="text-2xl font-extrabold text-white">N</span>
        </div>
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight">Nutree AI</h1>
        <p className="text-lg font-medium text-white/80 italic">Nutrition, naturally intelligent.</p>
        <div className="mt-12 max-w-xs text-center text-sm text-white/60">
          Tham gia cùng hàng trăm Personal Trainer đang sử dụng Nutree để phát triển thu nhập của mình.
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-[#F5F5F5] dark:bg-[#1F1F1F] px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              <span className="text-xl font-extrabold text-white">N</span>
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: "#1A4739" }}>Nutree AI</h1>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] p-8 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <h2 className="mb-1 text-xl font-extrabold text-[#1A4739] dark:text-white">Tạo tài khoản 🌱</h2>
            <p className="mb-6 text-sm text-gray-500 dark:text-[#B0B0B0]">Bắt đầu hành trình affiliate của bạn</p>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-semibold text-[#1A4739] dark:text-white">
                Họ và tên
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nguyễn Văn A" />
              </label>
              <label className="block text-sm font-semibold text-[#1A4739] dark:text-white">
                Email
                <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ban@example.com" />
              </label>
              <label className="block text-sm font-semibold text-[#1A4739] dark:text-white">
                Mật khẩu
                <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </label>
              {error && (
                <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                disabled={loading}
                className="h-11 w-full rounded-xl font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
              >
                {loading ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-gray-500 dark:text-[#B0B0B0]">
              Đã có tài khoản?{" "}
              <Link className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "#29B6A1" }} to="/login">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
