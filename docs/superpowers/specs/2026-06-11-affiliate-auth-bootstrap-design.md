# Affiliate Auth Bootstrap Design

## Goal

Fix the affiliate portal login/session flow so PT/KOL protected routes do not trust stale localStorage. Neon Auth is the source of truth. Local cached affiliate metadata is only a UI hint after a live Neon session has been confirmed.

## Problem

`/pt/bank` can render because `RequireRole` reads `nutree.session` from localStorage, but API calls still require a valid Neon JWT. When the Neon session is missing, expired, or temporarily unavailable, the page loads and then shows an HTTP 401 from `/api/affiliate/bank-info`.

The login flow also has scattered auth ownership:

- `Login` hydrates Neon Auth on callback.
- protected routes trust localStorage synchronously.
- API helpers fetch Neon JWTs independently.
- 401 handling clears Neon state but not the route-level stale localStorage decision soon enough.

## Design

Introduce one app-level auth bootstrap layer that owns affiliate session state.

### Components

`AuthProvider`

- Lives above `App` inside `main.tsx`.
- Owns auth state: `loading`, `authenticated`, `unauthenticated`.
- Stores the current affiliate `Session | null`.
- On boot, checks `authClient.getSession()`.
- If Neon session exists, calls `/api/affiliate/me` with the Neon JWT to load or create affiliate profile.
- If Neon session is missing or API returns 401, clears local cache and marks unauthenticated.

`useAuth`

- Exposes current auth state and actions:
  - `refreshSession()`
  - `logout()`
  - `setSession(session)`

`RequireRole`

- Uses `useAuth`, not direct localStorage.
- Shows a small loading state while auth is bootstrapping.
- Redirects unauthenticated users to `/login?next=<current path>`.
- Redirects wrong-role users to `/login?next=<current path>`.
- Handles PT onboarding redirect only after auth state is confirmed.

`Login`

- Reads `next` query param, defaulting to `/pt`.
- On Google click, calls Neon social sign-in with callback URL:
  - `/login?auth=callback&next=<encoded next>`
- On callback, shows "Đang hoàn tất đăng nhập".
- Calls `refreshSession()` until Neon session settles or a short retry window expires.
- Navigates to:
  - `next` if role and onboarding rules allow it.
  - `/pt/onboarding` if PT is not onboarded.
  - `/admin` for admin.

`authFetch`

- Keeps using Neon JWT for non-admin calls and admin token for admin calls.
- On 401:
  - clears Neon token cache
  - signs out Neon Auth for non-admin calls
  - clears local cached affiliate session
  - throws a typed authentication error so the auth provider can redirect.

## Data Flow

### Protected Route Load

1. User opens `/pt/bank`.
2. `RequireRole` asks `AuthProvider` for current state.
3. If state is loading, render loading text.
4. `AuthProvider` checks Neon session.
5. If session exists, fetch `/api/affiliate/me`.
6. If profile is valid and role matches, render `/pt/bank`.
7. If no Neon session or 401, clear cache and redirect to `/login?next=/pt/bank`.

### Google Login

1. User clicks "Đăng nhập với Google".
2. App redirects immediately to Neon Auth Google flow.
3. Neon redirects back to `/login?auth=callback&next=/pt/bank`.
4. Login page shows explicit finishing state.
5. `refreshSession()` confirms Neon session and loads affiliate profile.
6. App navigates to `/pt/bank`, `/pt/onboarding`, or `/admin`.

## Error Handling

- Missing Neon session: clear cache, redirect to login.
- API 401: clear Neon token cache, clear local affiliate cache, redirect to login with `next`.
- OAuth callback timeout: show an actionable login error and a retry button.
- Network failure during protected route bootstrap: show a retry state instead of rendering stale protected UI.

## Testing

Unit tests:

- `RequireRole` renders loading while auth bootstrap is pending.
- unauthenticated `/pt/bank` redirects to `/login?next=/pt/bank`.
- stale localStorage plus missing Neon session redirects to login.
- Google login passes `next` through callback URL.
- callback hydration navigates to preserved `next`.
- API 401 clears local cache and routes back to login.

Manual local checks:

- Start `npx vercel dev --listen 3001`.
- Login with Google once.
- Refresh `/pt/bank`; page should load without 401.
- Clear Neon/browser session but leave localStorage; `/pt/bank` should redirect to login, not show bank page.
- Login from `/login?next=/pt/bank`; after callback, return to `/pt/bank`.

## Out of Scope

- Changing Neon Auth provider configuration.
- Replacing custom login UI with Neon Auth UI components.
- Moving admin login to Neon Auth.
- Removing localStorage entirely.

## References

- Neon Auth React SPA setup uses `VITE_NEON_AUTH_URL` and `authClient.getSession()` for SPA session management.
- Neon Auth troubleshooting notes OAuth callback origins must be trusted domains.
- Neon custom backend guidance uses Neon-issued JWTs as Bearer tokens for API requests.
