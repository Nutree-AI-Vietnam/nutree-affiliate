import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./auth/guard";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/pt/Dashboard";
import { Referral } from "./pages/pt/Referral";
import { BankInfo } from "./pages/pt/BankInfo";
import { Guide } from "./pages/pt/Guide";
import { Onboarding } from "./pages/pt/Onboarding";
import { Conversions } from "./pages/pt/Conversions";
import { Earnings } from "./pages/pt/Earnings";
import { Overview } from "./pages/admin/Overview";
import { AffiliateDetail } from "./pages/admin/AffiliateDetail";
import { PayoutQueue } from "./pages/admin/PayoutQueue";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireRole role="pt" />}>
        <Route path="/pt" element={<Dashboard />} />
        <Route path="/pt/earnings" element={<Earnings />} />
        <Route path="/pt/conversions" element={<Conversions />} />
        <Route path="/pt/referral" element={<Referral />} />
        <Route path="/pt/bank" element={<BankInfo />} />
        <Route path="/pt/guide" element={<Guide />} />
        <Route path="/pt/onboarding" element={<Onboarding />} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<Overview />} />
        <Route path="/admin/affiliates/:id" element={<AffiliateDetail />} />
        <Route path="/admin/payouts" element={<PayoutQueue />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
