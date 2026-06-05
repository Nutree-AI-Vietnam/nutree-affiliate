import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api";
import { clearSession } from "../auth/session";

export function NavBar({ links, title }: { links: { to: string; label: string }[]; title: string }) {
  const api = useApi();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <strong>{title}</strong>
      <div className="flex gap-4 text-sm">
        {links.map((l) => <Link key={l.to} to={l.to} className="hover:underline">{l.label}</Link>)}
        <button
          onClick={async () => { await api.logout(); clearSession(); navigate("/login"); }}
          className="hover:underline">Logout</button>
      </div>
    </nav>
  );
}
