import type { VercelRequest, VercelResponse } from "@vercel/node";
import affiliateDetail from "../_lib/admin/affiliate-detail";
import approvePayoutRequest from "../_lib/admin/approve-payout-request";
import login from "../_lib/admin/login";
import markPaid from "../_lib/admin/mark-paid";
import overview from "../_lib/admin/overview";
import payoutRequests from "../_lib/admin/payout-requests";
import { ensureAffiliateIdentitySchema } from "../_lib/db";
import { normalizeCatchAllPath, normalizeRequestPath } from "../_lib/path-routing";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

export function adminPathParts(path: string | string[] | undefined): string[] {
  return normalizeCatchAllPath(path, "admin");
}

function withId(req: VercelRequest, id: string): void {
  req.query.id = id;
}

function resolveRoute(req: VercelRequest): Handler | null {
  const routePath = req.query.path ?? normalizeRequestPath(req.url, "admin");
  const parts = adminPathParts(routePath);
  if (parts.length === 1 && parts[0] === "login") return login;
  if (parts.length === 1 && parts[0] === "overview") return overview;
  if (parts.length === 1 && parts[0] === "payout-requests") return payoutRequests;

  if (parts.length === 2 && parts[1] === "mark-paid") {
    withId(req, parts[0]);
    return markPaid;
  }

  if (parts.length === 2 && parts[0] === "affiliates") {
    withId(req, parts[1]);
    return affiliateDetail;
  }

  if (parts.length === 3 && parts[0] === "payout-requests" && parts[2] === "approve") {
    withId(req, parts[1]);
    return approvePayoutRequest;
  }

  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const selected = resolveRoute(req);
  if (!selected) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await ensureAffiliateIdentitySchema();
  await selected(req, res);
}
