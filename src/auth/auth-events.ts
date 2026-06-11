export const AUTH_REQUIRED_EVENT = "nutree:auth-required";

export function notifyAuthRequired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
}
