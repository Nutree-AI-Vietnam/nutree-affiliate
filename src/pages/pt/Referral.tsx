import { useEffect, useState } from "react";
import { useApi } from "../../api";
import { NavBar } from "../../components/NavBar";
import { QrCode } from "../../components/QrCode";
import type { ReferralInfo } from "../../types";
import { ptLinks } from "./nav";

export function Referral() {
  const api = useApi();
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.getMyReferral().then(setReferral); }, [api]);

  return (
    <div>
      <NavBar title="Nutree Affiliates" links={ptLinks} />
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-xl font-bold">Your referral</h1>
        {!referral ? <p className="text-gray-500">Loading…</p> : (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
            <QrCode value={referral.link} size={200} />
            <div>
              <div className="text-xs uppercase text-gray-500">Referral code</div>
              <div className="text-2xl font-bold">{referral.code}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Shareable link</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{referral.link}</span>
                <button
                  className="rounded bg-black px-3 py-1 text-sm text-white"
                  onClick={async () => {
                    await navigator.clipboard.writeText(referral.link);
                    setCopied(true);
                  }}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
