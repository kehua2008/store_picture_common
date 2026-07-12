export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
