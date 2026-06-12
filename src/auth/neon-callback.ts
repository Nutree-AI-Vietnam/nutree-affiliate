export const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

export function hasNeonAuthSessionVerifier(search = window.location.search): boolean {
  return new URLSearchParams(search).has(NEON_AUTH_SESSION_VERIFIER_PARAM);
}
