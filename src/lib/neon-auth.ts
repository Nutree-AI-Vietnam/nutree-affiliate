import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

if (!authUrl) {
  throw new Error("VITE_NEON_AUTH_URL is not configured");
}

export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
});

interface NeonSessionResponse {
  data?: {
    session?: {
      token?: string | null;
    } | null;
  } | null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlightToken: Promise<string> | null = null;

function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 30_000;
  } catch {
    return Date.now() + 30_000;
  }
}

export function clearNeonAuthTokenCache(): void {
  cachedToken = null;
  inFlightToken = null;
}

async function loadNeonAuthToken(): Promise<string> {
  const session = await authClient.getSession() as NeonSessionResponse;
  const sessionToken = session.data?.session?.token;
  if (sessionToken) {
    cachedToken = { value: sessionToken, expiresAt: tokenExpiresAt(sessionToken) };
    return sessionToken;
  }

  const { data, error } = await authClient.token();
  if (error || !data?.token) {
    throw new Error(error?.message ?? "Not authenticated");
  }
  cachedToken = { value: data.token, expiresAt: tokenExpiresAt(data.token) };
  return data.token;
}

export async function getNeonAuthToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.value;
  }

  if (!inFlightToken) {
    inFlightToken = loadNeonAuthToken().finally(() => {
      inFlightToken = null;
    });
  }
  return inFlightToken;
}
