import { NavBar } from "../../components/NavBar";
import { ptLinks } from "./nav";

const STEPS = [
  {
    title: "Bước 1 — Tải ứng dụng Nutree",
    desc: "Khách hàng vào App Store và tải ứng dụng Nutree AI về điện thoại.",
  },
  {
    title: "Bước 2 — Mở ứng dụng & chọn đăng ký",
    desc: "Sau khi tải xong, mở app và chọn \"Đăng ký tài khoản mới\".",
  },
  {
    title: "Bước 3 — Nhập mã giới thiệu",
    desc: "Ở màn hình đăng ký, nhập mã giới thiệu của bạn (VD: MINHTU). Khách nhận ngay 20% giảm giá cho gói đăng ký đầu tiên.",
  },
  {
    title: "Bước 4 — Hoàn tất đăng ký",
    desc: "Khách điền thông tin và hoàn tất đăng ký. Hệ thống tự động ghi nhận hoa hồng cho bạn.",
  },
];

export function Guide() {
  return (
    <div>
      <NavBar title="Affiliate" links={ptLinks} />
      <main className="mx-auto max-w-3xl p-6 space-y-8">

        {/* Hero */}
        <div
          className="rounded-2xl p-8 text-white shadow-md"
          style={{ background: "linear-gradient(160deg, #1A4739 0%, #29B6A1 100%)" }}
        >
          <h1 className="text-2xl font-extrabold mb-1">Hướng dẫn dành cho Affiliate</h1>
          <p className="text-white/70 text-sm">Mọi thứ bạn cần biết để bắt đầu kiếm thu nhập cùng Nutree AI.</p>
        </div>

        {/* Payout date */}
        <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <div className="flex items-center gap-4 p-6">
            <div
              className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-extrabold text-white shadow"
              style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              5
            </div>
            <div>
              <div className="font-bold text-[#1A4739] dark:text-white text-base">Ngày thanh toán hoa hồng</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Hoa hồng được thanh toán vào <span className="font-semibold text-[#29B6A1]">ngày 5 hàng tháng</span>.
                Bạn cần cập nhật thông tin ngân hàng trước ngày 4 để nhận thanh toán đúng hạn.
              </p>
            </div>
          </div>
        </div>

        {/* Customer benefit */}
        <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <div className="flex items-center gap-4 p-6">
            <div
              className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-extrabold text-white shadow"
              style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
            >
              20%
            </div>
            <div>
              <div className="font-bold text-[#1A4739] dark:text-white text-base">Ưu đãi cho khách hàng của bạn</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Khi khách dùng <span className="font-semibold text-[#29B6A1]">mã giới thiệu của bạn</span> khi đăng ký,
                họ nhận ngay <span className="font-semibold text-[#29B6A1]">giảm 20%</span> gói đầu tiên —
                giúp bạn dễ chia sẻ và chuyển đổi hơn.
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step with placeholder images */}
        <div className="rounded-2xl bg-white dark:bg-[#2D2D2D] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "#29B6A1" }}>
              Hướng dẫn khách dùng mã
            </div>
          </div>

          <div className="px-6 pb-6 space-y-6">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-4">
                {/* Step number */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, #1A4739 0%, #29B6A1 100%)" }}
                  >
                    {i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-gray-200 dark:bg-white/10" style={{ minHeight: 24 }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="font-semibold text-[#1A4739] dark:text-white text-sm">{step.title}</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.desc}</p>

                  {/* Placeholder image */}
                  <div
                    className="mt-3 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs font-medium border-2 border-dashed border-gray-200 dark:border-white/10"
                    style={{ height: 140 }}
                  >
                    <div className="text-center space-y-1">
                      <svg className="w-8 h-8 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>Ảnh minh hoạ bước {i + 1}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-2xl bg-[#F0FAF8] dark:bg-[#1A4739]/30 p-6 ring-1 ring-[#29B6A1]/20">
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#29B6A1" }}>
            Mẹo tăng thu nhập
          </div>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex gap-2"><span className="text-[#29B6A1] font-bold mt-0.5">✓</span>Chia sẻ mã qua Instagram, TikTok, Facebook và nhóm chat cộng đồng.</li>
            <li className="flex gap-2"><span className="text-[#29B6A1] font-bold mt-0.5">✓</span>Tạo nội dung review thực tế về ứng dụng — video thật luôn chuyển đổi tốt hơn.</li>
            <li className="flex gap-2"><span className="text-[#29B6A1] font-bold mt-0.5">✓</span>Nhắc khách nhập mã ngay khi đăng ký — không nhập sau không tính được.</li>
            <li className="flex gap-2"><span className="text-[#29B6A1] font-bold mt-0.5">✓</span>Cập nhật thông tin ngân hàng trước ngày 4 hàng tháng để nhận tiền đúng hạn.</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
