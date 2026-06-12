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
import { hasNeonAuthSessionVerifier } from "./neon-callback";
import { clearSession, saveSession } from "./session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  error: Error | null;
  refreshSession(): Promise<Session | null>;
  setSession(session: Session): void;
  clearAuth(): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSessionState] = useState<Session | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const applySession = useCallback((nextSession: Session) => {
    saveSession(nextSession);
    setSessionState(nextSession);
    setStatus("authenticated");
    setError(null);
  }, []);

  const clearAuth = useCallback(() => {
    clearSession();
    setSessionState(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    try {
      const nextSession = await api.getCurrentSession();
      if (!nextSession) {
        clearAuth();
        return null;
      }
      applySession(nextSession);
      return nextSession;
    } catch (err) {
      clearAuth();
      const nextError = err instanceof Error ? err : new Error("Unable to refresh session");
      setError(nextError);
      return null;
    }
  }, [api, applySession, clearAuth]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Local logout must still succeed if the remote session is already gone.
    } finally {
      clearAuth();
    }
  }, [api, clearAuth]);

  useEffect(() => {
    if (hasNeonAuthSessionVerifier()) return;
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    function handleAuthRequired() {
      clearAuth();
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      refreshSession,
      setSession: applySession,
      clearAuth,
      logout,
    }),
    [applySession, clearAuth, error, logout, refreshSession, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within an AuthProvider");
  return auth;
}
