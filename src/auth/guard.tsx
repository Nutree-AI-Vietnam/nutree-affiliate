import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "./AuthProvider";

export function RequireRole({ role }: { role: Role }) {
  const auth = useAuth();
  const location = useLocation();
  const nextPath = `${location.pathname}${location.search}`;
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;

  if (auth.status === "loading") return <div>Đang xác thực…</div>;
  if (!auth.session) return <Navigate to={loginPath} replace />;
  if (auth.session.role !== role) return <Navigate to={loginPath} replace />;

  // Redirect new PT users to onboarding (unless already there)
  if (role === "pt" && !auth.session.onboarded && location.pathname !== "/pt/onboarding") {
    return <Navigate to="/pt/onboarding" replace />;
  }

  return <Outlet />;
}
