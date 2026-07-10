export type JsonRecord = Record<string, unknown>;

export async function readJsonRecord(response: Response): Promise<JsonRecord> {
  const body = await response.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body as JsonRecord : {};
}

export function describeRequestFailure(prefix: string, response: Response, body: JsonRecord = {}): string {
  if (response.status === 401) return `${prefix}：登录状态已失效，请重新登录后再试`;
  if (response.status === 403) return `${prefix}：当前账号没有权限访问该数据`;

  const serverError = typeof body.error === "string" && body.error.trim() ? body.error : "";
  if (serverError) return `${prefix}：${serverError}`;

  if (response.status >= 500) return `${prefix}：服务暂时异常（${response.status}），请稍后重试`;
  return `${prefix}：请求失败（${response.status}），请稍后重试`;
}

export function describeNetworkFailure(prefix: string, error: unknown): string {
  return `${prefix}：${error instanceof Error && error.message ? error.message : "网络请求失败，请检查连接后重试"}`;
}

export function redirectToAdminLogin(nextPath = typeof window !== "undefined" ? window.location.pathname : "/admin/members"): void {
  if (typeof window === "undefined") return;
  window.location.href = `/admin/login?next=${encodeURIComponent(nextPath)}`;
}
