export function normalizeCatchAllPath(
  path: string | string[] | undefined,
  baseSegment: string,
): string[] {
  const parts = Array.isArray(path) ? path : path ? path.split("/") : [];
  if (parts[0] === "api" && parts[1] === baseSegment) return parts.slice(2);
  if (parts[0] === baseSegment) return parts.slice(1);
  return parts;
}

export function normalizeRequestPath(
  requestUrl: string | undefined,
  baseSegment: string,
): string[] {
  if (!requestUrl) return [];
  const pathname = new URL(requestUrl, "https://local.test").pathname.replace(/^\/+/, "");
  return normalizeCatchAllPath(pathname, baseSegment);
}
