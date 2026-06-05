import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { clearSession } from "../auth/session";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const api = useApi();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between border-b border-green-800 bg-green-700 px-6 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-green-700 font-extrabold text-sm select-none">N</div>
        <span className="font-bold text-white tracking-wide">{title}</span>
      </div>
      <div className="flex items-center gap-1 text-sm">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="rounded px-3 py-1.5 text-green-100 hover:bg-green-600 hover:text-white transition-colors">
            {l.label}
          </Link>
        ))}
        <button
          onClick={async () => { await api.logout(); clearSession(); navigate("/login"); }}
          className="ml-2 rounded px-3 py-1.5 text-green-100 hover:bg-green-600 hover:text-white transition-colors">
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
