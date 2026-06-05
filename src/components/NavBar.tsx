import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { clearSession } from "../auth/session";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const api = useApi();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between bg-brand-gradient px-6 py-3 shadow-md">
      <div className="flex items-center gap-2.5">
        {/* Logo mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
          <span className="text-sm font-extrabold text-white select-none">N</span>
        </div>
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
        <button
          onClick={async () => { await api.logout(); clearSession(); navigate("/login"); }}
          className="ml-2 rounded-lg px-3 py-1.5 font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
