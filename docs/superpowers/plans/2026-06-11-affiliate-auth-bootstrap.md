# Affiliate Auth Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Neon Auth the source of truth for PT/KOL protected routes so stale localStorage cannot render `/pt/*` pages that later fail with HTTP 401.

**Architecture:** Add an app-level auth provider that verifies Neon session and affiliate profile before protected routes render. Keep localStorage as a cache only, and let API 401 responses broadcast an auth-required event so React auth state can clear and redirect. Preserve `next` through Google login and OAuth callback.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite, Vitest, Neon Auth, Vercel API routes.

---

## File Structure

- Create `src/auth/auth-events.ts`
  - Browser-safe event channel for API-layer auth invalidation.
- Create `src/auth/AuthProvider.tsx`
  - Owns `loading | authenticated | unauthenticated` state and current affiliate `Session`.
- Create `src/auth/__tests__/AuthProvider.test.tsx`
  - Verifies bootstrap, refresh, logout, and API 401 event behavior.
- Modify `src/main.tsx`
  - Wrap `App` with `AuthProvider` inside `ApiContext.Provider` and `BrowserRouter`.
- Modify `src/auth/guard.tsx`
  - Read auth state from `useAuth()` instead of synchronous localStorage.
- Modify `src/auth/__tests__/guard.test.tsx`
  - Update route-guard tests for loading, unauthenticated redirects with `next`, stale localStorage, role checks, and onboarding.
- Modify `src/api/index.ts`
  - Allow `login(nextPath?: string)`.
- Modify `src/api/mockApi.ts`
  - Match the `login(nextPath?: string)` signature.
- Modify `src/api/neonApi.ts`
  - Add `next` to callback URL and dispatch auth-required event on non-admin 401.
- Modify `src/api/__tests__/neonApi.test.ts`
  - Verify callback URL includes `next` and 401 dispatches auth-required event.
- Modify `src/pages/Login.tsx`
  - Use `next`, `AuthProvider.refreshSession()`, and explicit OAuth callback state.
- Modify `src/pages/__tests__/Login.test.tsx`
  - Verify next preservation, callback hydration navigation, and retry error display.
- Modify `src/components/NavBar.tsx`
  - Use `useAuth().logout()` so local cache and provider state clear together.

---

### Task 1: Add Auth Event Channel

**Files:**
- Create: `src/auth/auth-events.ts`
- Test: covered in Task 4 and Task 5 integration tests

- [ ] **Step 1: Create auth event helpers**

Create `src/auth/auth-events.ts`:

```ts
export const AUTH_REQUIRED_EVENT = "nutree:auth-required";

export function notifyAuthRequired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run build
```

Expected: build still passes.

- [ ] **Step 3: Commit**

```bash
git add src/auth/auth-events.ts
git commit -m "feat: add affiliate auth event channel"
```

---

### Task 2: Create Auth Provider

**Files:**
- Create: `src/auth/AuthProvider.tsx`
- Test: `src/auth/__tests__/AuthProvider.test.tsx`

- [ ] **Step 1: Write provider tests**

Create `src/auth/__tests__/AuthProvider.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { AUTH_REQUIRED_EVENT } from "../auth-events";
import { AuthProvider, useAuth } from "../AuthProvider";
import { loadSession, saveSession } from "../session";

function makeApi(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return {
    login: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(null),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getMyStats: vi.fn(),
    getMyReferral: vi.fn(),
    getMyBankInfo: vi.fn(),
    saveBankInfo: vi.fn(),
    getMyPayouts: vi.fn(),
    getAdminOverview: vi.fn(),
    markPayoutPaid: vi.fn(),
    getCommissionSetting: vi.fn(),
    ...overrides,
  };
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.session?.email ?? "none"}</span>
      <button onClick={() => auth.refreshSession()}>refresh</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
}

function renderWithApi(api: AffiliateApi, children: ReactNode = <Probe />) {
  return render(
    <ApiContext.Provider value={api}>
      <AuthProvider>{children}</AuthProvider>
    </ApiContext.Provider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => localStorage.clear());

  it("bootstraps an authenticated Neon session", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    });

    renderWithApi(api);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("alex@test.com");
    expect(loadSession()?.affiliateId).toBe("a1");
  });

  it("clears stale localStorage when Neon session is missing", async () => {
    saveSession({ affiliateId: "old", name: "Old", email: "old@test.com", role: "pt", onboarded: true });
    const api = makeApi({ getCurrentSession: vi.fn().mockResolvedValue(null) });

    renderWithApi(api);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(loadSession()).toBeNull();
  });

  it("clears auth state when an API request broadcasts auth-required", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    });
    renderWithApi(api);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(loadSession()).toBeNull();
  });

  it("logout calls API logout and clears local session", async () => {
    const api = makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    renderWithApi(api);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    screen.getByRole("button", { name: "logout" }).click();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(api.logout).toHaveBeenCalledOnce();
    expect(loadSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing provider test**

Run:

```bash
npm test -- --run src/auth/__tests__/AuthProvider.test.tsx
```

Expected: FAIL because `src/auth/AuthProvider.tsx` does not exist.

- [ ] **Step 3: Implement `AuthProvider`**

Create `src/auth/AuthProvider.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useApi } from "../api";
import type { Session } from "../types";
import { AUTH_REQUIRED_EVENT } from "./auth-events";
import { clearSession, saveSession } from "./session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  error: string | null;
  refreshSession: () => Promise<Session | null>;
  setSession: (session: Session) => void;
  clearAuth: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSessionState] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearAuth = useCallback(() => {
    clearSession();
    setSessionState(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const setSession = useCallback((nextSession: Session) => {
    saveSession(nextSession);
    setSessionState(nextSession);
    setStatus("authenticated");
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus((current) => (current === "authenticated" ? current : "loading"));
    try {
      const nextSession = await api.getCurrentSession();
      if (!nextSession) {
        clearAuth();
        return null;
      }
      setSession(nextSession);
      return nextSession;
    } catch (err) {
      clearAuth();
      setError(err instanceof Error ? err.message : "Không thể xác thực phiên đăng nhập");
      return null;
    }
  }, [api, clearAuth, setSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearAuth();
    }
  }, [api, clearAuth]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    window.addEventListener(AUTH_REQUIRED_EVENT, clearAuth);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, clearAuth);
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    error,
    refreshSession,
    setSession,
    clearAuth,
    logout,
  }), [status, session, error, refreshSession, setSession, clearAuth, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
```

- [ ] **Step 4: Run provider test**

Run:

```bash
npm test -- --run src/auth/__tests__/AuthProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/AuthProvider.tsx src/auth/__tests__/AuthProvider.test.tsx
git commit -m "feat: add affiliate auth provider"
```

---

### Task 3: Wire Auth Provider Into App

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Update provider order**

Modify `src/main.tsx` so `AuthProvider` wraps `App` inside `ApiContext.Provider` and `BrowserRouter`:

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createNeonApi } from "./api/neonApi";
import { AuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

const api = createNeonApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApiContext.Provider value={api}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ApiContext.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: wire affiliate auth provider"
```

---

### Task 4: Make Route Guard Use Auth State

**Files:**
- Modify: `src/auth/guard.tsx`
- Modify: `src/auth/__tests__/guard.test.tsx`

- [ ] **Step 1: Replace guard tests**

Replace `src/auth/__tests__/guard.test.tsx` with:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ApiContext } from "../../api";
import type { AffiliateApi } from "../../api";
import { AuthProvider } from "../AuthProvider";
import { RequireRole } from "../guard";
import { saveSession } from "../session";

function LocationProbe() {
  const location = useLocation();
  return <div>location:{location.pathname}{location.search}</div>;
}

function makeApi(overrides: Partial<AffiliateApi> = {}): AffiliateApi {
  return {
    login: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(null),
    register: vi.fn(),
    logout: vi.fn(),
    getMyStats: vi.fn(),
    getMyReferral: vi.fn(),
    getMyBankInfo: vi.fn(),
    saveBankInfo: vi.fn(),
    getMyPayouts: vi.fn(),
    getAdminOverview: vi.fn(),
    markPayoutPaid: vi.fn(),
    getCommissionSetting: vi.fn(),
    ...overrides,
  };
}

function renderRoutes(path: string, api: AffiliateApi) {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route element={<RequireRole role="pt" />}>
              <Route path="/pt/bank" element={<div>bank page</div>} />
              <Route path="/pt/onboarding" element={<div>onboarding page</div>} />
            </Route>
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin" element={<div>admin page</div>} />
            </Route>
            <Route path="/login" element={<LocationProbe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ApiContext.Provider>,
  );
}

describe("RequireRole", () => {
  beforeEach(() => localStorage.clear());

  it("redirects unauthenticated users to login with next path", async () => {
    renderRoutes("/pt/bank", makeApi({ getCurrentSession: vi.fn().mockResolvedValue(null) }));

    await waitFor(() => expect(screen.getByText("location:/login?next=%2Fpt%2Fbank")).toBeInTheDocument());
  });

  it("does not trust stale localStorage when Neon session is missing", async () => {
    saveSession({ affiliateId: "a1", name: "Alex", email: "alex@test.com", role: "pt", onboarded: true });
    renderRoutes("/pt/bank", makeApi({ getCurrentSession: vi.fn().mockResolvedValue(null) }));

    await waitFor(() => expect(screen.getByText("location:/login?next=%2Fpt%2Fbank")).toBeInTheDocument());
  });

  it("renders the protected route when auth state is confirmed", async () => {
    renderRoutes("/pt/bank", makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    }));

    await waitFor(() => expect(screen.getByText("bank page")).toBeInTheDocument());
  });

  it("redirects unonboarded PT users to onboarding after auth is confirmed", async () => {
    renderRoutes("/pt/bank", makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: false,
      }),
    }));

    await waitFor(() => expect(screen.getByText("onboarding page")).toBeInTheDocument());
  });

  it("redirects wrong role to login with next path", async () => {
    renderRoutes("/admin", makeApi({
      getCurrentSession: vi.fn().mockResolvedValue({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
    }));

    await waitFor(() => expect(screen.getByText("location:/login?next=%2Fadmin")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run failing guard tests**

Run:

```bash
npm test -- --run src/auth/__tests__/guard.test.tsx
```

Expected: FAIL because `RequireRole` still reads localStorage directly.

- [ ] **Step 3: Implement auth-state guard**

Replace `src/auth/guard.tsx` with:

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "./AuthProvider";

function loginPath(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function RequireRole({ role }: { role: Role }) {
  const { status, session } = useAuth();
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;

  if (status === "loading") {
    return <p className="p-6 text-sm text-gray-400">Đang xác thực…</p>;
  }

  if (!session || status === "unauthenticated") {
    return <Navigate to={loginPath(next)} replace />;
  }

  if (session.role !== role) {
    return <Navigate to={loginPath(next)} replace />;
  }

  if (role === "pt" && !session.onboarded && location.pathname !== "/pt/onboarding") {
    return <Navigate to="/pt/onboarding" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 4: Run guard tests**

Run:

```bash
npm test -- --run src/auth/__tests__/guard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/guard.tsx src/auth/__tests__/guard.test.tsx
git commit -m "feat: guard routes with live auth state"
```

---

### Task 5: Broadcast API 401 To Auth Provider

**Files:**
- Modify: `src/api/neonApi.ts`
- Modify: `src/api/__tests__/neonApi.test.ts`

- [ ] **Step 1: Update 401 test**

In `src/api/__tests__/neonApi.test.ts`, add `clearSession` and event expectations to the `"authFetch on 401"` test:

```ts
import { saveSession, loadSession } from "../../auth/session";
import { AUTH_REQUIRED_EVENT } from "../../auth/auth-events";
```

Use this test body:

```ts
it("clears cached auth, broadcasts auth-required, and throws on 401 response", async () => {
  const authRequiredSpy = vi.fn();
  window.addEventListener(AUTH_REQUIRED_EVENT, authRequiredSpy);
  saveSession({ affiliateId: "a1", name: "Alex", email: "alex@test.com", role: "pt", onboarded: true });
  mockGetNeonAuthToken.mockResolvedValue("expired-token");
  mockAuthClient.signOut.mockResolvedValue(undefined);
  mockFetch({ error: "Unauthorized" }, 401);

  const api = createNeonApi();
  await expect(api.getMyReferral()).rejects.toThrow("Session expired");

  expect(mockAuthClient.signOut).toHaveBeenCalledOnce();
  expect(loadSession()).toBeNull();
  expect(authRequiredSpy).toHaveBeenCalledOnce();
  window.removeEventListener(AUTH_REQUIRED_EVENT, authRequiredSpy);
});
```

- [ ] **Step 2: Run failing API test**

Run:

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: FAIL because `authFetch` does not dispatch `AUTH_REQUIRED_EVENT` or clear local session yet.

- [ ] **Step 3: Implement API 401 invalidation**

Modify imports in `src/api/neonApi.ts`:

```ts
import { clearSession, loadSession } from "../auth/session";
import { notifyAuthRequired } from "../auth/auth-events";
```

Replace the 401 branch in `authFetch`:

```ts
if (res.status === 401) {
  if (!session?.adminToken) {
    clearNeonAuthTokenCache();
    clearSession();
    notifyAuthRequired();
    await authClient.signOut();
  }
  throw new Error("Session expired");
}
```

- [ ] **Step 4: Run API tests**

Run:

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/neonApi.ts src/api/__tests__/neonApi.test.ts
git commit -m "feat: invalidate affiliate auth on api 401"
```

---

### Task 6: Preserve Next Path Through Google Login

**Files:**
- Modify: `src/api/index.ts`
- Modify: `src/api/mockApi.ts`
- Modify: `src/api/neonApi.ts`
- Modify: `src/api/__tests__/neonApi.test.ts`

- [ ] **Step 1: Update API interface**

Modify `src/api/index.ts`:

```ts
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
}
```

- [ ] **Step 2: Update mock API signature**

In `src/api/mockApi.ts`, change the login method signature only:

```ts
async login(_nextPath?: string): Promise<Session> {
  // keep existing body unchanged
}
```

- [ ] **Step 3: Update Neon API login callback URL**

In `src/api/neonApi.ts`, add this helper above `createNeonApi()`:

```ts
function localNextPath(nextPath?: string): string {
  if (!nextPath?.startsWith("/")) return "/pt";
  if (nextPath.startsWith("//")) return "/pt";
  return nextPath;
}
```

Then update `login`:

```ts
async login(nextPath?: string): Promise<Session> {
  const next = encodeURIComponent(localNextPath(nextPath));
  await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/login?auth=callback&next=${next}`,
  });
  throw new Error("Redirecting to Google sign-in");
},
```

- [ ] **Step 4: Update callback URL test**

In `src/api/__tests__/neonApi.test.ts`, update the login test call:

```ts
await expect(api.login("/pt/bank")).rejects.toThrow("Redirecting to Google sign-in");
expect(mockAuthClient.signIn.social).toHaveBeenCalledWith({
  provider: "google",
  callbackURL: `${window.location.origin}/login?auth=callback&next=%2Fpt%2Fbank`,
});
```

- [ ] **Step 5: Run API tests**

Run:

```bash
npm test -- --run src/api/__tests__/neonApi.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/index.ts src/api/mockApi.ts src/api/neonApi.ts src/api/__tests__/neonApi.test.ts
git commit -m "feat: preserve next path in affiliate login"
```

---

### Task 7: Refactor Login To Use Auth Provider

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/__tests__/Login.test.tsx`

- [ ] **Step 1: Add login tests for `next` and callback hydration**

In `src/pages/__tests__/Login.test.tsx`, wrap `Login` with `AuthProvider` and update `setup` to accept `initialPath`.

Use this setup:

```tsx
import { AuthProvider } from "../../auth/AuthProvider";

function setup(api: AffiliateApi = makeMockApiWithGoogle(), initialPath = "/login") {
  return render(
    <ApiContext.Provider value={api}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pt" element={<div>pt dashboard</div>} />
            <Route path="/pt/bank" element={<div>bank page</div>} />
            <Route path="/pt/onboarding" element={<div>onboarding</div>} />
            <Route path="/admin" element={<div>admin overview</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ApiContext.Provider>,
  );
}
```

Add these tests:

```tsx
it("passes next path to Google login", async () => {
  const api = makeMockApiWithGoogle({
    getCurrentSession: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockRejectedValue(new Error("Redirecting to Google sign-in")),
  });
  setup(api, "/login?next=/pt/bank");

  await userEvent.click(screen.getByRole("button", { name: /^đăng nhập$/i }));
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập với google/i }));

  await waitFor(() => expect(api.login).toHaveBeenCalledWith("/pt/bank"));
});

it("hydrates callback and returns to next path", async () => {
  const api = makeMockApiWithGoogle({
    getCurrentSession: vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        affiliateId: "a1",
        name: "Alex",
        email: "alex@test.com",
        role: "pt",
        onboarded: true,
      }),
  });
  setup(api, "/login?auth=callback&next=/pt/bank");

  expect(screen.getByText(/đang hoàn tất đăng nhập/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("bank page")).toBeInTheDocument());
});

it("shows a retry error when callback cannot hydrate a session", async () => {
  const api = makeMockApiWithGoogle({
    getCurrentSession: vi.fn().mockResolvedValue(null),
  });
  setup(api, "/login?auth=callback&next=/pt/bank");

  await waitFor(
    () => expect(screen.getByText(/không thể hoàn tất đăng nhập/i)).toBeInTheDocument(),
    { timeout: 3000 },
  );
});
```

- [ ] **Step 2: Run failing login tests**

Run:

```bash
npm test -- --run src/pages/__tests__/Login.test.tsx
```

Expected: FAIL because `Login` does not use `useAuth()` and does not pass `next` to `api.login()` yet.

- [ ] **Step 3: Implement safe next parsing and auth-provider callback**

In `src/pages/Login.tsx`, import `useAuth`:

```ts
import { useAuth } from "../auth/AuthProvider";
```

Add helpers above `Login`:

```ts
function safeNextPath(value: string | null): string {
  if (!value?.startsWith("/")) return "/pt";
  if (value.startsWith("//")) return "/pt";
  return value;
}
```

Inside `Login`, add:

```ts
const auth = useAuth();
const params = new URLSearchParams(window.location.search);
const nextPath = safeNextPath(params.get("next"));
const isAuthCallback = params.get("auth") === "callback";
```

Update `navigateAfterLogin`:

```ts
function navigateAfterLogin(session: Session) {
  auth.setSession(session);
  if (session.role === "admin") {
    navigate("/admin", { replace: true });
  } else if (!session.onboarded) {
    navigate("/pt/onboarding", { replace: true });
  } else {
    navigate(nextPath, { replace: true });
  }
}
```

Update callback hydration to use `auth.refreshSession()`:

```ts
useEffect(() => {
  if (!isAuthCallback) return;
  let active = true;

  async function hydrateSession() {
    setFinishingLogin(true);
    setLoading(true);
    for (let attempt = 0; attempt < 5 && active; attempt += 1) {
      const session = await auth.refreshSession();
      if (!active) return;
      if (session) {
        navigateAfterLogin(session);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    if (!active) return;
    setFinishingLogin(false);
    setLoading(false);
    setError("Không thể hoàn tất đăng nhập. Vui lòng thử lại.");
  }

  void hydrateSession();
  return () => {
    active = false;
  };
}, [auth, isAuthCallback, navigate, nextPath]);
```

Update Google click:

```ts
const session = await api.login(nextPath);
navigateAfterLogin(session);
```

- [ ] **Step 4: Run login tests**

Run:

```bash
npm test -- --run src/pages/__tests__/Login.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Login.tsx src/pages/__tests__/Login.test.tsx
git commit -m "feat: hydrate affiliate login through auth provider"
```

---

### Task 8: Update NavBar Logout

**Files:**
- Modify: `src/components/NavBar.tsx`

- [ ] **Step 1: Replace direct logout/session clearing**

Modify imports:

```ts
import { useAuth } from "../auth/AuthProvider";
```

Remove:

```ts
import { useApi } from "../api";
import { clearSession } from "../auth/session";
```

Inside `NavBar`, replace:

```ts
const api = useApi();
```

with:

```ts
const auth = useAuth();
```

Update `handleLogout`:

```ts
const handleLogout = async () => {
  await auth.logout();
  navigate("/login");
};
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/NavBar.tsx
git commit -m "feat: route logout through auth provider"
```

---

### Task 9: Full Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build passes. Existing Vite large chunk warning is acceptable.

- [ ] **Step 3: Restart local Vercel dev**

Stop existing dev server, then run:

```bash
npx vercel dev --listen 3001
```

Expected: `Ready! Available at http://localhost:3001`.

- [ ] **Step 4: Verify unauthenticated protected route redirect**

In browser devtools or manually:

1. Clear localStorage.
2. Open `http://localhost:3001/pt/bank`.
3. Expected: app redirects to `/login?next=%2Fpt%2Fbank`.

- [ ] **Step 5: Verify stale localStorage cannot render protected UI**

In browser console:

```js
localStorage.setItem("nutree.session", JSON.stringify({
  affiliateId: "stale",
  name: "Stale",
  email: "stale@test.com",
  role: "pt",
  onboarded: true
}));
location.href = "/pt/bank";
```

Expected: app redirects to `/login?next=%2Fpt%2Fbank` unless a real Neon session exists.

- [ ] **Step 6: Verify Google login returns to bank page**

1. Open `http://localhost:3001/login?next=/pt/bank`.
2. Click Google login.
3. Complete Google OAuth.
4. Expected: callback shows `Đang hoàn tất đăng nhập`, then navigates to `/pt/bank`.
5. Expected: bank form loads without HTTP 401.

- [ ] **Step 7: Commit verification-only changes if any**

If no files changed, do not commit.

If test snapshots or expected strings changed, commit only those files:

```bash
git add <changed-test-files>
git commit -m "test: verify affiliate auth bootstrap"
```

---

## Self-Review

- Spec coverage:
  - AuthProvider source of truth: Task 2 and Task 3.
  - RequireRole no longer trusts localStorage: Task 4.
  - Login callback with next path: Task 6 and Task 7.
  - API 401 invalidation: Task 5.
  - Logout consistency: Task 8.
  - Testing and manual local checks: Task 9.
- Placeholder scan: explicit code and commands are included for every task.
- Type consistency:
  - `login(nextPath?: string): Promise<Session>` is updated in interface, mock API, Neon API, and tests.
  - `Session` remains the existing `src/types/index.ts` type.
  - `AUTH_REQUIRED_EVENT` is shared through `src/auth/auth-events.ts`.
