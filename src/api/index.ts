// src/api/index.ts
import { createContext, useContext } from "react";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview,
  MonthlyEarning, Conversion, AdminPayoutRequest, AdminAffiliateDetail,
} from "../types";

export interface AffiliateApi {
  login(nextPath?: string): Promise<Session>;
  getCurrentSession(): Promise<Session | null>;
  register(): Promise<Session>;
  logout(): Promise<void>;

  getMyStats(): Promise<MyStats>;
  getMyReferral(): Promise<ReferralInfo>;
  getMyBankInfo(): Promise<BankInfo | null>;
  saveBankInfo(info: BankInfo): Promise<BankInfo>;
  getMyPayouts(): Promise<Payout[]>;

  getAdminOverview(): Promise<AdminOverview>;
  markPayoutPaid(affiliateId: string, note?: string): Promise<void>;
  getCommissionSetting(): Promise<{ commissionPerConversion: number }>;

  getMyConversions(): Promise<Conversion[]>;
  getMyMonthlyEarnings(): Promise<MonthlyEarning[]>;
  requestPayout(month: string): Promise<{ id: string; status: string; period: string; requestedAt: string }>;

  getAdminAffiliateDetail(affiliateId: string): Promise<AdminAffiliateDetail>;
  getAdminPayoutRequests(): Promise<AdminPayoutRequest[]>;
  approvePayoutRequest(requestId: string, note?: string): Promise<{ status: string; period: string }>;
}

export const ApiContext = createContext<AffiliateApi | null>(null);

export function useApi(): AffiliateApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an ApiContext provider");
  return api;
}
