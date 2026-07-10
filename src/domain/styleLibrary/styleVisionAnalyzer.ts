import { inferStyleLayout, type StyleSampleAnalysis } from "./styleLibrary";

const maxStylePromptLength = 2048;

export interface StyleVisionAnalysisInput {
  filename: string;
  mimeType: string;
  bytes: Buffer;
  platform: string;
  category: string;
  imageType: string;
  styleName: string;
}

export interface StyleVisionSuggestion {
  category?: string;
  imageType?: string;
  styleName?: string;
  confidence: number;
  reasoning: string;
  tags: string[];
}

export interface StyleVisionAnalysisResult {
  analysis: StyleSampleAnalysis;
  suggestion: StyleVisionSuggestion;
  analyzer: string;
  stylePrompt?: string;
  negativePrompt?: string;
  model?: string;
  usage?: Record<string, unknown>;
}

export interface StyleVisionAnalyzer {
  readonly name: string;
  analyze(input: StyleVisionAnalysisInput): Promise<StyleVisionAnalysisResult>;
}

export interface HeuristicStyleVisionAnalyzerOptions {
  analyze: (input: { filename: string; platform: string; category: string; imageType: string; styleName: string }) => StyleSampleAnalysis;
  inferStyleName: (filename: string) => string;
}

export class HeuristicStyleVisionAnalyzer implements StyleVisionAnalyzer {
  readonly name = "heuristic";
  private readonly analyzeFallback: HeuristicStyleVisionAnalyzerOptions["analyze"];
  private readonly inferStyleName: HeuristicStyleVisionAnalyzerOptions["inferStyleName"];

  constructor(options: HeuristicStyleVisionAnalyzerOptions) {
    this.analyzeFallback = options.analyze;
    this.inferStyleName = options.inferStyleName;
  }

  async analyze(input: StyleVisionAnalysisInput): Promise<StyleVisionAnalysisResult> {
    const suggestedStyleName = input.styleName && input.styleName !== "待归类风格" ? input.styleName : this.inferStyleName(input.filename);
    const analysis = this.analyzeFallback({ ...input, styleName: suggestedStyleName || input.styleName });
    return {
      analyzer: this.name,
      analysis,
      stylePrompt: buildFallbackStylePrompt(analysis, suggestedStyleName || input.styleName),
      negativePrompt: analysis.avoid.join(", "),
      suggestion: {
        category: input.category,
        imageType: input.imageType,
        styleName: suggestedStyleName || input.styleName,
        confidence: suggestedStyleName && suggestedStyleName !== "待归类风格" ? 0.62 : 0.28,
        reasoning: "本地规则兜底分析：根据后台填写字段和文件名关键词生成初步标签。接入视觉模型后会替换为图片理解结果。",
        tags: [
          ...analysis.background.slice(0, 2),
          ...analysis.lighting.slice(0, 2),
          ...analysis.camera.slice(0, 2),
          ...analysis.pose.slice(0, 2)
        ]
      }
    };
  }
}

export interface OpenAICompatibleStyleVisionAnalyzerOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetcher?: typeof fetch;
  fallback: StyleVisionAnalyzer;
}

type VisionJson = {
  category?: string;
  imageType?: string;
  styleName?: string;
  background?: string[];
  lighting?: string[];
  camera?: string[];
  pose?: string[];
  palette?: string[];
  props?: string[];
  composition?: string[];
  layout?: string[];
  avoid?: string[];
  qualityScore?: number;
  summary?: string;
  confidence?: number;
  reasoning?: string;
  tags?: string[];
  stylePrompt?: string;
  negativePrompt?: string;
};

export class OpenAICompatibleStyleVisionAnalyzer implements StyleVisionAnalyzer {
  readonly name = "openai-compatible-vision";
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetcher: typeof fetch;
  private readonly fallback: StyleVisionAnalyzer;

  constructor(options: OpenAICompatibleStyleVisionAnalyzerOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
    this.model = options.model ?? "gpt-4o-mini";
    this.fetcher = options.fetcher ?? fetch;
    this.fallback = options.fallback;
  }

  async analyze(input: StyleVisionAnalysisInput): Promise<StyleVisionAnalysisResult> {
    if (!this.apiKey) return this.fallback.analyze(input);

    try {
      const response = await this.fetcher(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are an ecommerce visual style analyst. Return strict JSON only. Do not mention copyrighted brands, source merchants, logos, exact people, or copyable identities."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    "Analyze this ecommerce image and return JSON with keys:",
                    "category, imageType, styleName, background, lighting, camera, pose, palette, props, composition, layout, avoid, qualityScore, summary, confidence, reasoning, tags, stylePrompt, negativePrompt.",
                    "Use concise Chinese styleName suitable for a frontend ecommerce classic style button.",
                    "stylePrompt must describe only reusable visual direction: layout, background, environment, lighting, tone, camera, composition and commercial retouching. It must not copy product identity, logos, people, text, exact props, brand marks, garment/material/pattern/silhouette from the reference image.",
                    "negativePrompt must list visual elements to avoid, especially copied logos, text, unrelated products, people, props, and source-image product identity.",
                    `Current admin hint: platform=${input.platform}, category=${input.category}, imageType=${input.imageType}, styleName=${input.styleName}.`,
                    "If the admin hint is wrong, suggest better category/imageType/styleName."
                  ].join(" ")
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) return this.fallback.analyze(input);

      const body = await response.json().catch(() => undefined);
      const content = body?.choices?.[0]?.message?.content;
      const parsed = typeof content === "string" ? parseVisionJson(content) : undefined;
      if (!parsed) return this.fallback.analyze(input);

      const fallback = await this.fallback.analyze({
        ...input,
        styleName: parsed.styleName || input.styleName
      });
      const fallbackLayout = fallback.analysis.layout ?? inferStyleLayout({
        filename: input.filename,
        platform: input.platform,
        category: input.category,
        imageType: input.imageType,
        styleName: parsed.styleName || input.styleName
      });
      const analysis: StyleSampleAnalysis = {
        background: cleanList(parsed.background, fallback.analysis.background),
        lighting: cleanList(parsed.lighting, fallback.analysis.lighting),
        camera: cleanList(parsed.camera, fallback.analysis.camera),
        pose: cleanList(parsed.pose, fallback.analysis.pose),
        palette: cleanList(parsed.palette, fallback.analysis.palette),
        props: cleanList(parsed.props, fallback.analysis.props),
        composition: cleanList(parsed.composition, fallback.analysis.composition),
        layout: cleanList(parsed.layout, fallbackLayout),
        avoid: cleanList(parsed.avoid, fallback.analysis.avoid),
        qualityScore: clampScore(parsed.qualityScore ?? fallback.analysis.qualityScore),
        summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : fallback.analysis.summary
      };

      return {
        analyzer: this.name,
        analysis,
        stylePrompt: cleanPromptString(parsed.stylePrompt) ?? buildFallbackStylePrompt(analysis, cleanString(parsed.styleName) ?? input.styleName),
        negativePrompt: cleanPromptString(parsed.negativePrompt) ?? analysis.avoid.join(", "),
        model: this.model,
        usage: typeof body?.usage === "object" && body.usage !== null ? body.usage as Record<string, unknown> : undefined,
        suggestion: {
          category: cleanString(parsed.category) ?? input.category,
          imageType: cleanString(parsed.imageType) ?? input.imageType,
          styleName: cleanString(parsed.styleName) ?? input.styleName,
          confidence: clampConfidence(parsed.confidence ?? fallback.suggestion.confidence),
          reasoning: cleanString(parsed.reasoning) ?? fallback.suggestion.reasoning,
          tags: cleanList(parsed.tags, fallback.suggestion.tags)
        }
      };
    } catch {
      return this.fallback.analyze(input);
    }
  }
}

export function createStyleVisionAnalyzer(options: HeuristicStyleVisionAnalyzerOptions): StyleVisionAnalyzer {
  const fallback = new HeuristicStyleVisionAnalyzer(options);
  const provider = process.env.STYLE_VISION_PROVIDER ?? (process.env.NODE_ENV === "test" ? "heuristic" : "openai_compatible");
  if (provider !== "openai_compatible") return fallback;
  return new OpenAICompatibleStyleVisionAnalyzer({
    apiKey: process.env.STYLE_VISION_API_KEY ?? process.env.YUNWU_API_KEY,
    baseUrl: process.env.STYLE_VISION_BASE_URL ?? process.env.YUNWU_BASE_URL ?? "https://yunwu.ai",
    model: process.env.STYLE_VISION_MODEL || undefined,
    fallback
  });
}

function parseVisionJson(content: string): VisionJson | undefined {
  try {
    const parsed = JSON.parse(content) as unknown;
    return typeof parsed === "object" && parsed !== null ? parsed as VisionJson : undefined;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return typeof parsed === "object" && parsed !== null ? parsed as VisionJson : undefined;
    } catch {
      return undefined;
    }
  }
}

function cleanList(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback;
  const values = input.map((item) => String(item).trim()).filter(Boolean);
  return values.length ? Array.from(new Set(values)).slice(0, 12) : fallback;
}

function cleanString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, 80) : undefined;
}

function cleanPromptString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, maxStylePromptLength) : undefined;
}

function buildFallbackStylePrompt(analysis: StyleSampleAnalysis, styleName: string): string {
  const layout = analysis.layout?.slice(0, 5).join(", ");
  return [
    `Reference style "${styleName}" controls the reusable scene structure, especially layout, background, environment, lighting, tone, lens and composition.`,
    layout ? `Layout and visual hierarchy: ${layout}.` : undefined,
    `Background: ${analysis.background.slice(0, 5).join(", ")}.`,
    `Lighting: ${analysis.lighting.slice(0, 4).join(", ")}.`,
    `Camera and composition: ${[...analysis.camera.slice(0, 4), ...analysis.composition.slice(0, 4)].join(", ")}.`,
    analysis.pose.length ? `Pose or subject placement: ${analysis.pose.slice(0, 4).join(", ")}.` : undefined,
    `Palette and retouching mood: ${analysis.palette.slice(0, 5).join(", ")}.`,
    "Highest priority: preserve the uploaded product identity exactly, including logo, material, texture, pattern, silhouette, shape, construction and color blocking. Do not copy unrelated objects, people, text, logos or product identity from the reference style image."
  ].join(" ");
}

function clampScore(input: number): number {
  if (!Number.isFinite(input)) return 80;
  return Math.max(0, Math.min(100, Math.round(input)));
}

function clampConfidence(input: number): number {
  if (!Number.isFinite(input)) return 0.5;
  return Math.max(0, Math.min(1, input));
}
