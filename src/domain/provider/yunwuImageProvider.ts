import { readFile } from "fs/promises";
import type { GenerationJob, GenerationSourceImage, ImageGenerationProvider, ImageProviderResult } from "../jobs/generationJobs";

export class YunwuImageProvider implements ImageGenerationProvider {
  async generate(input: { prompt: string; sourceImages: GenerationSourceImage[]; width: number; height: number }): Promise<{ ok: true; images: ImageProviderResult[] } | { ok: false; error: NonNullable<GenerationJob["error"]> }> {
    const apiKey = process.env.YUNWU_API_KEY?.trim();
    if (!apiKey) return failure("provider_missing_config", "生图服务尚未配置，请联系管理员完成模型服务配置。", false);
    if (!input.sourceImages.length) return failure("provider_bad_request", "请至少上传一张商品图片。", false);

    const form = new FormData();
    for (const source of input.sourceImages.slice(0, 12)) {
      const bytes = await readFile(source.filePath).catch(() => undefined);
      if (!bytes?.length) return failure("provider_bad_request", `商品素材 ${source.filename} 无法读取。`, false);
      form.append("image", new Blob([bytes], { type: source.mimeType || "image/png" }), source.filename);
    }
    form.append("prompt", input.prompt);
    form.append("model", process.env.YUNWU_IMAGE_MODEL?.trim() || "gpt-image-2");
    form.append("n", "1");
    form.append("quality", normalizeQuality(process.env.YUNWU_IMAGE_QUALITY));
    form.append("size", `${input.width}x${input.height}`);

    try {
      const response = await fetch(`${(process.env.YUNWU_BASE_URL?.trim() || "https://yunwu.ai").replace(/\/$/, "")}/v1/images/edits`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(normalizeTimeout(process.env.YUNWU_IMAGE_TIMEOUT_MS, 120_000))
      });
      if (!response.ok) return failureFromResponse(response);
      const body = await response.json().catch(() => ({}));
      const images = extractImages(body);
      return images.length ? { ok: true, images } : failure("provider_unknown", "模型未返回可用图片，请稍后重试。", true);
    } catch (error) {
      const timeout = error instanceof Error && error.name === "TimeoutError";
      return failure(timeout ? "provider_timeout" : "provider_unknown", timeout ? "生图服务响应较慢，任务会自动重试。" : safeMessage(error), true);
    }
  }
}

function extractImages(value: unknown): ImageProviderResult[] {
  const candidates = [
    valueAt(value, ["data"]), valueAt(value, ["images"]), valueAt(value, ["output"]), valueAt(value, ["result"]), valueAt(value, ["result", "data"])
  ];
  for (const candidate of candidates) {
    const values = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
    const images = values.map(asImage).filter((item): item is ImageProviderResult => Boolean(item));
    if (images.length) return images;
  }
  return [];
}

function asImage(value: unknown): ImageProviderResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const base64 = firstString(record.b64_json, record.b64, record.base64, record.image_base64);
  const imageUrl = record.image_url;
  const url = firstString(record.url, typeof imageUrl === "object" && imageUrl ? (imageUrl as Record<string, unknown>).url : imageUrl, record.imageUrl, record.output_url, record.outputUrl);
  return base64 || url ? { base64, url, mimeType: "image/png" } : undefined;
}

function valueAt(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

async function failureFromResponse(response: Response): Promise<{ ok: false; error: NonNullable<GenerationJob["error"]> }> {
  const body = (await response.text().catch(() => "")).replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]").slice(0, 500);
  if (response.status === 429) return failure("provider_rate_limited", "当前生图任务较多，系统会自动排队重试。", true);
  return failure(response.status < 500 ? "provider_bad_request" : "provider_unknown", body || "生图服务请求失败。", response.status >= 500);
}

function failure(code: string, message: string, retryable: boolean): { ok: false; error: NonNullable<GenerationJob["error"]> } {
  return { ok: false, error: { code, message, retryable } };
}

function normalizeTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(5_000, Math.min(300_000, Math.trunc(parsed))) : fallback;
}

function normalizeQuality(value: string | undefined): string {
  return ["low", "medium", "high", "auto"].includes(value ?? "") ? value! : "medium";
}

function safeMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : "生图服务暂时不可用。";
}
