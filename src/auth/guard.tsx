import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { loadSession } from "./session";

export function RequireRole({ role }: { role: Role }) {
  const session = loadSession();
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to="/login" replace />;

  // Redirect new PT users to onboarding (unless already there)
  if (role === "pt" && !session.onboarded && location.pathname !== "/pt/onboarding") {
    return <Navigate to="/pt/onboarding" replace />;
  }

  return <Outlet />;
}
