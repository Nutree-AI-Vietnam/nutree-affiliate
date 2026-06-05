import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { clearSession } from "../auth/session";
import { useThemeContext } from "../lib/ThemeContext";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const api = useApi();
  const navigate = useNavigate();
  const { dark, toggle } = useThemeContext();
  return (
    <nav className="flex items-center justify-between bg-brand-gradient px-6 py-3 shadow-md">
      <div className="flex items-center gap-2.5">
        {/* Logo mark */}
        <img src="/logo-icon.png" alt="Nutree AI" className="h-9 w-9 rounded-xl object-cover" />
        <div className="leading-none">
          <span className="font-extrabold text-white tracking-tight">
            Nutree <span className="text-brand-teal font-extrabold" style={{ color: "#7FE0D2" }}>AI</span>
          </span>
          <div className="text-[10px] font-medium text-white/60 tracking-widest uppercase">{title}</div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-sm">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-lg px-3 py-1.5 font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            {l.label}
          </Link>
        ))}
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          aria-label={dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          className="ml-1 rounded-lg px-2.5 py-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          title={dark ? "Chế độ sáng" : "Chế độ tối"}
        >
          {dark ? "☀️" : "🌙"}
        </button>
        <button
          onClick={async () => { await api.logout(); clearSession(); navigate("/login"); }}
          className="ml-1 rounded-lg px-3 py-1.5 font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
