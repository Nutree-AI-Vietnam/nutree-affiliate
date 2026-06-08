// src/api/index.ts
import { createContext, useContext } from "react";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview,
} from "../types";

export interface AffiliateApi {
  login(): Promise<Session>;
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
}

export const ApiContext = createContext<AffiliateApi | null>(null);

export function useApi(): AffiliateApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an ApiContext provider");
  return api;
}
