import type { VideoError } from "../jobs/videoJobs";

export class YunwuVideoProvider {
  async create(input: { prompt: string; images: string[]; aspectRatio: string; durationSeconds: number }): Promise<{ ok: true; task: { id: string; model: string } } | { ok: false; error: VideoError }> {
    const key = process.env.YUNWU_API_KEY?.trim();
    if (!key) return fail("provider_missing_config", "生视频服务尚未配置，请联系管理员完成模型服务配置。", false);
    if (!input.images.length) return fail("provider_bad_request", "请上传至少一张商品图片。", false);
    const baseUrl = (process.env.YUNWU_BASE_URL?.trim() || "https://yunwu.ai").replace(/\/$/, "");
    const model = process.env.YUNWU_VIDEO_PRIMARY_MODEL?.trim() || "doubao-seedance-2-0-260128";
    const endpoint = process.env.YUNWU_VIDEO_PRIMARY_CREATE_PATH?.trim() || "/api/v3/contents/generations/tasks";
    try {
      const response = await fetch(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, content: [{ type: "text", text: input.prompt }, ...input.images.map((url) => ({ type: "image_url", image_url: { url }, role: "reference_image" }))], generate_audio: false, ratio: input.aspectRatio, duration: input.durationSeconds, watermark: false }), signal: AbortSignal.timeout(120_000) });
      if (!response.ok) return responseFailure(response);
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const nested = data.data && typeof data.data === "object" ? data.data as Record<string, unknown> : {};
      const id = stringValue(nested.task_id) ?? stringValue(data.id) ?? stringValue(data.request_id);
      return id ? { ok: true, task: { id, model } } : fail("provider_unknown", "视频模型未返回任务编号。", true);
    } catch (error) { return fail("provider_unknown", safeMessage(error), true); }
  }
  async get(input: { id: string; model?: string }): Promise<{ ok: true; status: string; outputUrl?: string } | { ok: false; error: VideoError }> {
    const key = process.env.YUNWU_API_KEY?.trim(); if (!key) return fail("provider_missing_config", "生视频服务尚未配置。", false);
    const baseUrl = (process.env.YUNWU_BASE_URL?.trim() || "https://yunwu.ai").replace(/\/$/, "");
    const pattern = process.env.YUNWU_VIDEO_PRIMARY_STATUS_PATH?.trim() || "/api/v3/contents/generations/tasks/{id}";
    const endpoint = pattern.replace("{id}", encodeURIComponent(input.id));
    try { const response = await fetch(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, { headers: { Accept: "application/json", Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(60_000) }); if (!response.ok) return responseFailure(response); const data = await response.json().catch(() => ({})); return { ok: true, status: findStatus(data), outputUrl: findVideoUrl(data) }; } catch (error) { return fail("provider_unknown", safeMessage(error), true); }
  }
}

async function responseFailure(response: Response) { const message = (await response.text().catch(() => "")).slice(0, 500) || "视频模型请求失败。"; return fail(response.status === 429 ? "provider_rate_limited" : response.status < 500 ? "provider_bad_request" : "provider_unknown", response.status === 429 ? "当前视频任务较多，系统会稍后重试。" : message, response.status >= 500 || response.status === 429); }
function fail(code: string, message: string, retryable: boolean): { ok: false; error: VideoError } { return { ok: false, error: { code, message, retryable } }; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }
function findStatus(value: unknown): string { if (!value || typeof value !== "object") return "processing"; const data = value as Record<string, unknown>; const nested = data.data && typeof data.data === "object" ? data.data as Record<string, unknown> : {}; return stringValue(nested.task_status) ?? stringValue(data.status) ?? "processing"; }
function findVideoUrl(value: unknown): string | undefined { if (typeof value === "string") return /^https?:\/\//.test(value) && (/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(value)) ? value : undefined; if (Array.isArray(value)) return value.map(findVideoUrl).find(Boolean); if (!value || typeof value !== "object") return undefined; const entries = Object.entries(value as Record<string, unknown>); for (const [, item] of [...entries.filter(([key]) => /video|url|output|result/i.test(key)), ...entries]) { const url = findVideoUrl(item); if (url) return url; } return undefined; }
function safeMessage(error: unknown): string { return error instanceof Error && error.message ? error.message.slice(0, 500) : "视频生成服务暂时不可用。"; }
