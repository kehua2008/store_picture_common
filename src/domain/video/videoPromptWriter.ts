export type VideoPromptWriterInput = {
  mode: "draft" | "revise";
  brief?: string;
  currentScript?: string;
  revision?: string;
  productImages: string[];
  category: string;
  videoGoal: string;
  platform: string;
  durationSeconds: number;
  outputResolution: "480p" | "720p";
  musicMode: string;
  voiceoverMode: string;
  subtitleMode: string;
};

export type VideoPromptWriterResult = {
  script: string;
  summary: string;
  plan: VideoCreativePlan;
  provider: string;
  model: string;
};

export class VideoPromptWriterError extends Error {
  constructor(readonly code: string, message: string, readonly status = 500) {
    super(message);
    this.name = "VideoPromptWriterError";
  }
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

export class OpenAICompatibleVideoPromptWriter {
  constructor(
    private readonly options: { apiKey?: string; baseUrl: string; model: string; fetcher?: typeof fetch }
  ) {}

  async write(input: VideoPromptWriterInput): Promise<VideoPromptWriterResult> {
    const apiKey = this.options.apiKey?.trim();
    if (!apiKey) throw new VideoPromptWriterError("video_prompt_writer_not_configured", "AI提示词代写服务暂未配置，请稍后重试。", 503);
    const response = await (this.options.fetcher ?? fetch)(`${this.options.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.options.model,
        temperature: input.mode === "revise" ? 0.35 : 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a senior ecommerce short-video director for general merchandise products.",
              "Return strict JSON only with keys summary and plan.",
              "Write in Chinese.",
              "The script must be a concrete shot-by-shot prompt for a video-generation model.",
              "Preserve product facts from the uploaded product images. Do not turn a household product into apparel or force a human model unless the user specifically requests it.",
              "Do not add brands, watermarks, QR codes, prices, certifications, unsupported claims, or nonexistent product features.",
              "plan must contain productProfile and scenes. Every scene lasts five seconds or less, has one visual action, an anchorImageIndex, narration and caption."
            ].join(" ")
          },
          { role: "user", content: buildUserContent(input) }
        ]
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new VideoPromptWriterError("video_prompt_writer_provider_failed", detail || "AI提示词代写失败，请稍后重试。", response.status);
    }
    const body = await response.json().catch(() => undefined) as ChatCompletionResponse | undefined;
    const parsed = parseResult(body?.choices?.[0]?.message?.content);
    if (!parsed) throw new VideoPromptWriterError("video_prompt_writer_invalid_response", "AI提示词代写返回内容无法识别，请重试。", 502);
    const planInput = toPlanInput(input);
    const plan = normalizeVideoCreativePlan(parsed.plan, planInput);
    return {
      script: limitScript(parsed.script || scriptFromVideoCreativePlan(plan)),
      summary: parsed.summary || (input.mode === "revise" ? "已按补充意见重写视频提示词。" : "已根据商品图和需求生成视频提示词。"),
      plan,
      provider: providerName(this.options.baseUrl),
      model: this.options.model
    };
  }
}

export function createVideoPromptWriter(): OpenAICompatibleVideoPromptWriter {
  const baseUrl = firstNonEmpty(process.env.VIDEO_PROMPT_WRITER_BASE_URL, process.env.YUNWU_BASE_URL, process.env.OPENAI_BASE_URL, "https://api.openai.com")!;
  return new OpenAICompatibleVideoPromptWriter({
    apiKey: firstNonEmpty(process.env.VIDEO_PROMPT_WRITER_API_KEY, process.env.YUNWU_API_KEY, process.env.OPENAI_API_KEY),
    baseUrl,
    model: firstNonEmpty(process.env.VIDEO_PROMPT_WRITER_MODEL, process.env.YUNWU_TEXT_MODEL, process.env.OPENAI_TEXT_MODEL, "gpt-4o-mini")!
  });
}

function buildUserContent(input: VideoPromptWriterInput): Array<Record<string, unknown>> {
  const text = [
    input.mode === "revise" ? "Task: rewrite the full approved video prompt according to the revision note." : "Task: draft a new ecommerce video prompt from the user's brief and product images.",
    `User brief: ${input.brief?.trim() || "用户未填写具体需求，请根据商品图生成一条适合电商展示的原创短视频。"}`,
    input.mode === "revise" ? `Current script:\n${input.currentScript?.trim() || "(empty)"}` : undefined,
    input.mode === "revise" ? `Revision note: ${input.revision?.trim() || "(empty)"}` : undefined,
    `Controls: category=${input.category}; video type=${input.videoGoal}; platform=${input.platform}; duration=${input.durationSeconds}s; resolution=${input.outputResolution}; music=${input.musicMode}; voiceover=${input.voiceoverMode}; subtitle=${input.subtitleMode}.`,
    [
      "Output requirements:",
      "- JSON only: {\"summary\":\"...\",\"plan\":{...}}. You may additionally return script.",
      "- plan.productProfile must contain title, identityFacts, visualFacts, forbiddenChanges and verified.",
      "- plan.scenes must contain exactly one 5-second-or-less scene per 5 seconds of duration. Each scene has anchorImageIndex, purpose, visualPrompt, narration and caption.",
      "- Keep within selected duration; product remains visible and recognizable.",
      "- Do not invent functions, materials, text, packaging, accessories, people, or a scene unsupported by the product image and brief."
    ].join("\n")
  ].filter(Boolean).join("\n\n");
  return [
    { type: "text", text },
    ...input.productImages.slice(0, 6).map((url) => ({ type: "image_url", image_url: { url } }))
  ];
}

function parseResult(content: unknown): { script: string; summary: string; plan?: unknown } | undefined {
  if (typeof content !== "string" || !content.trim()) return undefined;
  const trimmed = content.trim();
  const json = safeJson(trimmed) ?? safeJson(extractJsonObject(trimmed));
  if (json && typeof json === "object") {
    const candidate = json as { script?: unknown; summary?: unknown; plan?: unknown };
    if ((typeof candidate.script === "string" && candidate.script.trim()) || candidate.plan) {
      return { script: typeof candidate.script === "string" ? candidate.script.trim() : "", summary: typeof candidate.summary === "string" ? candidate.summary.trim() : "", plan: candidate.plan };
    }
  }
  return { script: trimmed, summary: "", plan: undefined };
}

function toPlanInput(input: VideoPromptWriterInput) {
  return {
    brief: input.brief,
    durationSeconds: input.durationSeconds,
    imageCount: input.productImages.length,
    category: input.category,
    videoGoal: input.videoGoal,
    platform: input.platform,
    musicMode: input.musicMode,
    voiceoverMode: input.voiceoverMode,
    subtitleMode: input.subtitleMode
  };
}

function safeJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function extractJsonObject(value: string): string | undefined {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start >= 0 && end > start ? value.slice(start, end + 1) : undefined;
}

function limitScript(value: string): string {
  return value.length > 2_800 ? `${value.slice(0, 2_760)}\n提示词已压缩，请保留以上商品事实、分镜计划和限制规则。` : value;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function providerName(baseUrl: string): string {
  return baseUrl.toLowerCase().includes("yunwu") ? "yunwu" : baseUrl.toLowerCase().includes("openai") ? "openai" : "openai_compatible";
}
import { normalizeVideoCreativePlan, scriptFromVideoCreativePlan, type VideoCreativePlan } from "./videoCreativePlan";
