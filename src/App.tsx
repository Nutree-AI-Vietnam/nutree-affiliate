import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./auth/guard";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/pt/Dashboard";
import { Referral } from "./pages/pt/Referral";
import { BankInfo } from "./pages/pt/BankInfo";
import { Guide } from "./pages/pt/Guide";
import { Overview } from "./pages/admin/Overview";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireRole role="pt" />}>
        <Route path="/pt" element={<Dashboard />} />
        <Route path="/pt/referral" element={<Referral />} />
        <Route path="/pt/bank" element={<BankInfo />} />
        <Route path="/pt/guide" element={<Guide />} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<Overview />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
