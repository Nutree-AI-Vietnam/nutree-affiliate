import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "../types";
import { loadSession } from "./session";

export function RequireRole({ role }: { role: Role }) {
  const session = loadSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to="/login" replace />;
  return <Outlet />;
}
