import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { clearSession } from "../auth/session";
import { useThemeContext } from "../lib/ThemeContext";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const api = useApi();
  const navigate = useNavigate();
  const { dark, toggle } = useThemeContext();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await api.logout();
    clearSession();
    navigate("/login");
  };

  return (
    <nav className="bg-brand-gradient shadow-md">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-icon.png" alt="Nutree AI" className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
          <div className="leading-none min-w-0">
            <span className="font-extrabold text-white tracking-tight whitespace-nowrap">
              Nutree <span className="font-extrabold" style={{ color: "#7FE0D2" }}>AI</span>
            </span>
            <div className="text-[10px] font-medium text-white/60 tracking-widest uppercase">{title}</div>
          </div>
        </div>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-0.5 text-sm">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg px-3 py-1.5 font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={toggle}
            aria-label={dark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <button
            onClick={handleLogout}
            className="ml-1 rounded-lg px-3 py-1.5 font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            Đăng xuất
          </button>
        </div>

        {/* Mobile: dark toggle + hamburger */}
        <div className="flex sm:hidden items-center gap-1">
          <button
            onClick={toggle}
            className="rounded-lg px-2.5 py-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
            aria-label="Menu"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-white/10 px-4 pb-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="text-left rounded-lg px-3 py-2 font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </nav>
  );
}
