import { describe, expect, it } from "vitest";
import { OpenAICompatibleVideoPromptWriter, VideoPromptWriterError } from "../../src/domain/video/videoPromptWriter";

const request = {
  mode: "draft" as const,
  productImages: ["data:image/png;base64,AA=="],
  category: "家居用品",
  videoGoal: "功能演示",
  platform: "抖音短视频",
  durationSeconds: 5,
  outputResolution: "480p" as const,
  musicMode: "AI自动配乐",
  voiceoverMode: "不需要配音",
  subtitleMode: "AI生成字幕"
};

describe("OpenAICompatibleVideoPromptWriter", () => {
  it("returns a parsed script from the provider JSON response", async () => {
    const writer = new OpenAICompatibleVideoPromptWriter({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      model: "test-model",
      fetcher: async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ script: "1. 商品近景\n2. 使用展示", summary: "已完成" }) } }]
      }), { status: 200 })
    });

    await expect(writer.write(request)).resolves.toMatchObject({ script: "1. 商品近景\n2. 使用展示", summary: "已完成", model: "test-model" });
  });

  it("instructs the model to choose hands from product evidence instead of making them the default", async () => {
    let sent = "";
    const writer = new OpenAICompatibleVideoPromptWriter({
      apiKey: "test-key",
      baseUrl: "https://example.test",
      model: "test-model",
      fetcher: async (_url, init) => {
        sent = String(init?.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ script: "商品亮相", summary: "已完成" }) } }] }), { status: 200 });
      }
    });

    await writer.write({ ...request, videoGoal: "AI智能判断", category: "汽车服务" });

    expect(sent).toContain("never default to hands");
    expect(sent).toContain("Cars, large appliances, furniture and large equipment");
    expect(sent).toContain("AI智能判断");
  });

  it("does not call a provider without an API key", async () => {
    const writer = new OpenAICompatibleVideoPromptWriter({ apiKey: "", baseUrl: "https://example.test", model: "test-model" });
    await expect(writer.write(request)).rejects.toMatchObject({ code: "video_prompt_writer_not_configured", status: 503 } satisfies Partial<VideoPromptWriterError>);
  });
});
