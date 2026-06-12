import type { VercelRequest, VercelResponse } from "@vercel/node";
import bankInfo from "../_lib/affiliate/bank-info";
import conversions from "../_lib/affiliate/conversions";
import me from "../_lib/affiliate/me";
import monthlyEarnings from "../_lib/affiliate/monthly-earnings";
import onboard from "../_lib/affiliate/onboard";
import payoutRequest from "../_lib/affiliate/payout-request";
import payouts from "../_lib/affiliate/payouts";
import referralCode from "../_lib/affiliate/referral-code";
import stats from "../_lib/affiliate/stats";
import { ensureAffiliateIdentitySchema } from "../_lib/db";
import { normalizeCatchAllPath, normalizeRequestPath } from "../_lib/path-routing";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const routes: Record<string, Handler> = {
  "bank-info": bankInfo,
  conversions,
  me,
  "monthly-earnings": monthlyEarnings,
  onboard,
  "payout-request": payoutRequest,
  payouts,
  "referral-code": referralCode,
  stats,
};

export function affiliateRouteKey(path: string | string[] | undefined): string {
  return normalizeCatchAllPath(path, "affiliate").join("/");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const routePath = req.query.path ?? normalizeRequestPath(req.url, "affiliate");
  const selected = routes[affiliateRouteKey(routePath)];
  if (!selected) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await ensureAffiliateIdentitySchema();
  await selected(req, res);
}
