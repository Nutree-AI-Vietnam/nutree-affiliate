import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { saveSession } from "../auth/session";

type Step = "landing" | "signin";

/* ─── icons ─── */
function CheckIcon() {
  return (
    <svg className="size-3.5 shrink-0 text-[#29B6A1]" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── earnings calculator ─── */
function EarningsCalculator() {
  const [users, setUsers] = useState(5);
  const COMMISSION = 300_000; // VND per user
  const monthly = users * COMMISSION;

  function formatVND(n: number) {
    return n.toLocaleString("vi-VN") + " ₫";
  }

  const pct = ((users - 1) / (100 - 1)) * 100;

  return (
    <div
      className="animate-[slideUp_0.7s_ease_both_450ms] flex flex-col gap-5"
      style={{ animationFillMode: "both" }}
    >
      <div>
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-white tracking-tight">
          Máy tính thu nhập
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Kéo để xem bạn có thể kiếm bao nhiêu mỗi tháng.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] p-6 shadow-sm">
        {/* Earnings display */}
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Bạn có thể kiếm</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-5xl font-semibold tracking-tight text-neutral-800 dark:text-white">
            {formatVND(monthly)}
          </span>
          <span className="text-base font-medium text-neutral-400 dark:text-neutral-500">/tháng</span>
        </div>

        {/* Slider inner card with wave bg */}
        <div className="relative mt-6 overflow-hidden rounded-[10px] bg-neutral-50 dark:bg-[#1F1F1F] p-5">
          {/* Wave decoration */}
          <svg
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.07] dark:opacity-[0.04]"
            width="260" height="120" viewBox="0 0 260 120" fill="none"
          >
            <path d="M0 60 Q40 20 80 60 Q120 100 160 60 Q200 20 240 60 Q260 80 280 60" stroke="#29B6A1" strokeWidth="18" fill="none"/>
            <path d="M-20 80 Q40 40 80 80 Q120 120 160 80 Q200 40 240 80 Q260 100 280 80" stroke="#1A4739" strokeWidth="14" fill="none"/>
            <path d="M-20 40 Q40 0 80 40 Q120 80 160 40 Q200 0 240 40 Q260 60 280 40" stroke="#29B6A1" strokeWidth="10" fill="none"/>
          </svg>

          <p className="relative text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {users} người dùng mua app
          </p>

          {/* Custom styled range slider */}
          <div className="relative mt-3">
            <input
              type="range"
              min={1}
              max={100}
              value={users}
              onChange={(e) => setUsers(Number(e.target.value))}
              className="earnings-slider w-full"
              style={{ "--pct": `${pct}%` } as React.CSSProperties}
            />
          </div>

          <div className="relative mt-3 flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 8h2M5 10.5h6M5 5.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Kiếm 300.000 ₫ cho mỗi người dùng
          </div>
        </div>

        {/* Per-user breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[1, 10, 50].map((n) => (
            <button
              key={n}
              onClick={() => setUsers(n)}
              className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                users === n
                  ? "border-[#29B6A1] bg-[#29B6A1]/10 text-[#29B6A1]"
                  : "border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20"
              }`}
            >
              {n} người
              <div className="mt-0.5 text-[10px] font-normal opacity-70">
                {formatVND(n * COMMISSION)}/tháng
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── why nutree needs you ─── */
function WhyNutree() {
  const reasons = [
    {
      icon: "🥗",
      title: "Việt Nam đang đứng trước khủng hoảng sức khỏe",
      desc: "Hơn 60% người Việt thiếu kiến thức dinh dưỡng cơ bản. Bệnh tiểu đường, béo phì và tim mạch gia tăng nhanh chóng.",
    },
    {
      icon: "🏋️",
      title: "PT là cầu nối tin cậy nhất",
      desc: "Học viên tin tưởng PT của họ hơn bất kỳ quảng cáo nào. Lời khuyên từ bạn có giá trị gấp 10 lần một banner trên mạng.",
    },
    {
      icon: "📱",
      title: "Nutree AI — dinh dưỡng thông minh cho người Việt",
      desc: "Ứng dụng được xây dựng riêng cho thói quen ăn uống Việt Nam, với AI cá nhân hóa kế hoạch dinh dưỡng cho từng người.",
    },
    {
      icon: "🌱",
      title: "Cùng nhau xây dựng Việt Nam khỏe mạnh hơn",
      desc: "Mỗi người dùng bạn giới thiệu là một bước tiến tới lối sống lành mạnh hơn cho cộng đồng. Bạn không chỉ kiếm tiền — bạn tạo ra tác động.",
    },
  ];

  return (
    <div
      className="animate-[slideUp_0.7s_ease_both_500ms] flex flex-col gap-5"
      style={{ animationFillMode: "both" }}
    >
      <div>
        <span className="block font-mono text-xs font-medium uppercase tracking-widest text-[#29B6A1]">
          Sứ mệnh
        </span>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-800 dark:text-white tracking-tight">
          Tại sao Nutree cần bạn?
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 leading-5">
          Mục tiêu của chúng tôi: đưa lối sống lành mạnh đến với mọi người Việt Nam.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {reasons.map((r, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] p-5"
          >
            <span className="text-2xl leading-none mt-0.5">{r.icon}</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-white leading-5">{r.title}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-4">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mission statement banner */}
      <div
        className="relative overflow-hidden rounded-xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
      >
        <div className="relative z-10">
          <p className="text-lg font-semibold leading-snug">
            "Chúng tôi tin rằng mỗi người Việt Nam đều xứng đáng được sống khỏe mạnh — và bạn là người giúp điều đó xảy ra."
          </p>
          <p className="mt-3 text-sm text-white/70">— Đội ngũ Nutree AI</p>
        </div>
        {/* bg decoration */}
        <svg className="pointer-events-none absolute -right-8 -top-8 opacity-10" width="160" height="160" viewBox="0 0 160 160" fill="none">
          <circle cx="80" cy="80" r="70" stroke="white" strokeWidth="20"/>
          <circle cx="80" cy="80" r="40" stroke="white" strokeWidth="12"/>
        </svg>
      </div>
    </div>
  );
}

/* ─── landing hero ─── */
function LandingView({ onApply }: { onApply: () => void }) {
  return (
    <div className="relative z-10 flex flex-col gap-8 px-6 py-10">
      {/* Brand tag */}
      <span className="block font-mono text-xs font-medium uppercase tracking-widest text-[#29B6A1] animate-[fadeIn_0.6s_ease_both]">
        Nutree Affiliates
      </span>

      {/* Hero headline */}
      <div className="animate-[slideUp_0.7s_ease_both_100ms]" style={{ animationFillMode: "both" }}>
        <h1 className="text-5xl font-medium leading-[1.1] tracking-[-0.96px] text-neutral-800 dark:text-white">
          Chia sẻ Nutree AI.{" "}
          <span className="text-neutral-400 dark:text-neutral-500">Nhận hoa hồng.</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p
        className="text-base text-neutral-600 dark:text-neutral-400 leading-6 tracking-[-0.02em] max-w-sm animate-[slideUp_0.7s_ease_both_200ms]"
        style={{ animationFillMode: "both" }}
      >
        Giới thiệu Nutree AI đến cộng đồng, học viên hoặc mạng lưới của bạn. Kiếm{" "}
        <strong className="font-semibold text-neutral-800 dark:text-white">300.000 ₫</strong> cho mỗi người dùng mua app.
      </p>

      {/* CTA */}
      <div
        className="flex flex-col gap-2 animate-[slideUp_0.7s_ease_both_300ms]"
        style={{ animationFillMode: "both" }}
      >
        <button
          onClick={onApply}
          className="group flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#29B6A1] bg-[#29B6A1] px-4 text-sm font-semibold text-white transition-all hover:bg-[#1D9080] hover:border-[#1D9080] hover:ring-4 hover:ring-[#29B6A1]/20 active:scale-[.98]"
        >
          Đăng nhập ngay
          <ArrowRight />
        </button>
      </div>

      {/* Stats cards */}
      <div
        className="grid grid-cols-2 gap-3 animate-[slideUp_0.7s_ease_both_400ms]"
        style={{ animationFillMode: "both" }}
      >
        <div className="relative overflow-hidden rounded-[10px] border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#2D2D2D] p-5">
          <p className="text-3xl font-semibold text-neutral-800 dark:text-white">300k ₫</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Hoa hồng mỗi user</p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">mua app Nutree AI</p>
        </div>
        <div className="relative overflow-hidden rounded-[10px] border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-[#2D2D2D] p-5">
          <p className="text-3xl font-semibold text-neutral-800 dark:text-white">20%</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Giảm giá cho học viên</p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">với mã giới thiệu của bạn</p>
        </div>
      </div>

      {/* Earnings calculator */}
      <EarningsCalculator />

      {/* Why Nutree needs you */}
      <WhyNutree />

      {/* Feature list */}
      <div
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] p-6 animate-[slideUp_0.7s_ease_both_550ms]"
        style={{ animationFillMode: "both" }}
      >
        <p className="text-sm font-semibold text-neutral-700 dark:text-white">Tại sao chọn Nutree Affiliates?</p>
        <ul className="flex flex-col gap-2 text-sm font-medium tracking-[-0.02em] text-neutral-600 dark:text-neutral-300">
          {[
            "Theo dõi hoa hồng thời gian thực",
            "Thanh toán nhanh chóng, minh bạch",
            "Dashboard riêng cho Personal Trainer",
            "Mã giới thiệu cá nhân hoá",
            "Hỗ trợ trực tiếp từ đội ngũ Nutree",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckIcon />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <img src="/logo-icon.png" alt="Nutree AI" className="h-6 w-6 rounded-md object-cover opacity-60" />
        <span>© 2025 Nutree AI. All rights reserved.</span>
      </div>
    </div>
  );
}

/* ─── main export ─── */
export function Login() {
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("landing");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const session = await api.login("", "");
      saveSession(session);
      navigate(session.role === "admin" ? "/admin" : "/pt");
    } catch (err: unknown) {
      // Popup closed by user — ignore
      if ((err as { code?: string }).code === "auth/popup-closed-by-user") return;
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#1F1F1F]">
      {/* Sticky navbar */}
      <nav className="sticky top-0 z-20 mx-px flex items-center justify-between bg-white/90 dark:bg-[#1F1F1F]/90 px-6 py-4 backdrop-blur-sm border-b border-neutral-100 dark:border-white/10">
        <button onClick={() => setStep("landing")} className="flex items-center gap-2 transition-opacity hover:opacity-70">
          <img src="/logo-icon.png" alt="Nutree AI" className="h-7 w-7 rounded-lg object-cover" />
          <span className="font-semibold text-sm text-neutral-800 dark:text-white">Nutree AI</span>
        </button>

        {step === "landing" ? (
          <button
            onClick={() => setStep("signin")}
            className="h-8 px-3 rounded-lg text-sm font-medium border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5 transition-all"
          >
            Đăng nhập
          </button>
        ) : (
          <button
            onClick={() => setStep("landing")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M13 8H3M7 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Quay lại
          </button>
        )}
      </nav>

      {/* Page body */}
      <div className="relative mx-auto w-full max-w-screen-sm">
        {/* Decorative side border lines */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full border-x border-neutral-200 dark:border-white/10 [mask-image:linear-gradient(black_60%,transparent)]" />

        {step === "landing" ? (
          <LandingView onApply={() => setStep("signin")} />
        ) : (
          <div className="relative z-10 flex flex-col gap-5 px-6 py-10 animate-[slideUp_0.5s_ease_both]" style={{ animationFillMode: "both" }}>
            <div>
              <span className="block font-mono text-xs font-medium uppercase tracking-widest text-[#29B6A1]">
                Nutree Affiliates
              </span>
              <h1 className="mt-3 text-4xl font-medium leading-[1.1] tracking-[-0.8px] text-neutral-800 dark:text-white">
                Chào mừng trở lại
              </h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                Đăng nhập để xem dashboard của bạn
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#2D2D2D] p-6 shadow-sm flex flex-col gap-4">
              {error && (
                <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="group flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1F1F1F] px-4 text-sm font-semibold text-neutral-800 dark:text-white transition-all hover:bg-neutral-50 dark:hover:bg-white/5 hover:ring-2 hover:ring-neutral-200 dark:hover:ring-white/10 active:scale-[.98] disabled:opacity-50"
              >
                <svg className="size-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loading ? "Đang đăng nhập…" : "Đăng nhập với Google"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
