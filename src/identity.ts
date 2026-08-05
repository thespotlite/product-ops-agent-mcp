export function accessUserEmail(request: Request): string {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) return "unknown";
  try {
    const payload = assertion.split(".")[1];
    if (!payload) return "unknown";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email : "unknown";
  } catch {
    return "unknown";
  }
}
