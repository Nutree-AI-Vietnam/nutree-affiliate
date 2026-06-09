// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createNeonApi } from "./api/neonApi";
import { ThemeProvider } from "./lib/ThemeContext";
import { auth } from "./lib/firebase";
import { saveSession, loadSession, clearSession } from "./auth/session";
import "./index.css";

const api = createNeonApi();

// On Firebase auth state ready, sync session from server so onboarded flag is always fresh
auth.onAuthStateChanged(async (firebaseUser) => {
  if (!firebaseUser) {
    clearSession();
    return;
  }
  try {
    const token = await firebaseUser.getIdToken();
    const res = await fetch("/api/affiliate/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const profile = await res.json() as {
      affiliateId: string; name: string; email: string;
      role: string; onboarded: boolean;
    };
    const existing = loadSession();
    saveSession({
      ...(existing ?? {}),
      affiliateId: profile.affiliateId,
      name: profile.name,
      email: profile.email,
      role: profile.role as "pt" | "admin",
      onboarded: profile.onboarded,
    });
  } catch {
    // ignore — guard will handle redirect
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApiContext.Provider value={api}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiContext.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
