import {
  signInWithPopup, signOut, type User,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
} from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";
import type { AffiliateApi } from "./index";
import type {
  Session, MyStats, ReferralInfo, BankInfo, Payout, AdminOverview, AffiliateRow,
} from "../types";

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

function currentUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}

export function createFirebaseApi(): AffiliateApi {
  return {
    async login(): Promise<Session> {
      const result = await signInWithPopup(auth, googleProvider);
      const user: User = result.user;
      const uid = user.uid;
      const ref = doc(db, "affiliates", uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const referralCode = generateReferralCode(uid);
        await setDoc(ref, {
          name: user.displayName ?? "Affiliate",
          email: user.email ?? "",
          role: "pt",
          referralCode,
          referralLink: `https://nutree.app/r/${referralCode}`,
          bankInfo: null,
        });
      }

      const data = snap.exists() ? snap.data() : (await getDoc(ref)).data()!;
      return {
        affiliateId: uid,
        name: data.name,
        email: data.email,
        role: data.role,
      };
    },

    async register(): Promise<Session> {
      // Registration happens through login() via Google — this method is unused
      throw new Error("Use Google Sign-In");
    },

    async logout(): Promise<void> {
      await signOut(auth);
    },

    async getMyStats(): Promise<MyStats> {
      const uid = currentUid();
      const convSnap = await getDocs(collection(db, "conversions", uid, "entries"));
      const paySnap = await getDocs(collection(db, "payouts", uid, "entries"));
      const settingSnap = await getDoc(doc(db, "settings", "commission"));
      const commission: number = settingSnap.exists()
        ? settingSnap.data().commissionPerConversion
        : 300000;

      let pendingTrials = 0;
      let activeSubscriptions = 0;
      convSnap.forEach((d) => {
        const c = d.data();
        if (c.status === "trial") pendingTrials++;
        if (c.status === "active") activeSubscriptions++;
      });

      const totalRevenue = activeSubscriptions * commission;

      let lastPaymentDate: string | null = null;
      let totalPayout = 0;
      paySnap.forEach((d) => {
        const p = d.data();
        if (p.status === "paid") {
          totalPayout += p.amount ?? 0;
          if (!lastPaymentDate || p.paidDate > lastPaymentDate) {
            lastPaymentDate = p.paidDate;
          }
        }
      });

      return { totalRevenue, totalPayout, pendingTrials, activeSubscriptions, lastPaymentDate };
    },

    async getMyReferral(): Promise<ReferralInfo> {
      const uid = currentUid();
      const snap = await getDoc(doc(db, "affiliates", uid));
      if (!snap.exists()) throw new Error("Affiliate not found");
      const data = snap.data();
      return { code: data.referralCode, link: data.referralLink };
    },

    async getMyBankInfo(): Promise<BankInfo | null> {
      const uid = currentUid();
      const snap = await getDoc(doc(db, "affiliates", uid));
      if (!snap.exists()) return null;
      return snap.data().bankInfo ?? null;
    },

    async saveBankInfo(info: BankInfo): Promise<BankInfo> {
      const uid = currentUid();
      await updateDoc(doc(db, "affiliates", uid), { bankInfo: info });
      return info;
    },

    async getMyPayouts(): Promise<Payout[]> {
      const uid = currentUid();
      const snap = await getDocs(collection(db, "payouts", uid, "entries"));
      return snap.docs.map((d) => d.data() as Payout);
    },

    async getAdminOverview(): Promise<AdminOverview> {
      const affSnap = await getDocs(collection(db, "affiliates"));
      const settingSnap = await getDoc(doc(db, "settings", "commission"));
      const commissionPerConversion: number = settingSnap.exists()
        ? settingSnap.data().commissionPerConversion
        : 300000;

      const rows: AffiliateRow[] = [];
      let totalRevenue = 0;
      let totalPayoutOwed = 0;
      let pendingTrials = 0;
      let activeSubscriptions = 0;

      for (const affDoc of affSnap.docs) {
        const uid = affDoc.id;
        const aff = affDoc.data();
        const [convSnap, paySnap] = await Promise.all([
          getDocs(collection(db, "conversions", uid, "entries")),
          getDocs(collection(db, "payouts", uid, "entries")),
        ]);

        let affPending = 0;
        let affActive = 0;
        convSnap.forEach((d) => {
          const c = d.data();
          if (c.status === "trial") affPending++;
          if (c.status === "active") affActive++;
        });

        const affRevenue = affActive * commissionPerConversion;
        const affPayoutOwed = affActive * commissionPerConversion;
        pendingTrials += affPending;
        activeSubscriptions += affActive;
        totalRevenue += affRevenue;
        totalPayoutOwed += affPayoutOwed;
        let lastPaidDate: string | null = null;
        paySnap.forEach((d) => {
          const p = d.data();
          if (p.status === "paid" && (!lastPaidDate || p.paidDate > lastPaidDate)) {
            lastPaidDate = p.paidDate;
          }
        });

        rows.push({
          affiliateId: uid,
          name: aff.name,
          code: aff.referralCode,
          pendingTrials: affPending,
          activeSubscriptions: affActive,
          totalRevenue: affRevenue,
          payoutOwed: affPayoutOwed,
          hasBankInfo: !!aff.bankInfo,
          lastPaidDate,
        });
      }

      return {
        totalRevenue,
        totalPayoutOwed,
        activeAffiliates: rows.length,
        pendingTrials,
        activeSubscriptions,
        commissionPerConversion,
        affiliates: rows,
      };
    },

    async markPayoutPaid(affiliateId: string): Promise<void> {
      const paySnap = await getDocs(collection(db, "payouts", affiliateId, "entries"));
      const today = new Date().toISOString().slice(0, 10);
      for (const payDoc of paySnap.docs) {
        if (payDoc.data().status === "pending") {
          await updateDoc(payDoc.ref, { status: "paid", paidDate: today });
        }
      }
    },

    async getCommissionSetting(): Promise<{ commissionPerConversion: number }> {
      const snap = await getDoc(doc(db, "settings", "commission"));
      return { commissionPerConversion: snap.exists() ? snap.data().commissionPerConversion : 300000 };
    },
  };
}
