import { afterEach, describe, expect, it } from "vitest";
import { YunwuVideoProvider } from "../../src/domain/provider/yunwuVideoProvider";
import { buildFallbackVideoCreativePlan } from "../../src/domain/video/videoCreativePlan";

const environmentKeys = ["ARK_VIDEO_API_KEY", "ARK_VIDEO_BASE_URL", "ARK_VIDEO_MODEL", "ARK_VIDEO_CREATE_PATH"] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

describe("YunwuVideoProvider", () => {
  it("uses Ark as the default multi-image path and sends every product view to a scene", async () => {
    process.env.ARK_VIDEO_API_KEY = "test-key";
    process.env.ARK_VIDEO_BASE_URL = "https://ark.example.test";
    process.env.ARK_VIDEO_MODEL = "seedance-test";
    process.env.ARK_VIDEO_CREATE_PATH = "/video/tasks";
    let requestInit: RequestInit | undefined;
    globalThis.fetch = async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ data: { task_id: "ark-task-1" } }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new YunwuVideoProvider();
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 5, imageCount: 3 });

    const result = await provider.create({
      prompt: "保持真实商品外观",
      images: ["https://cdn.example.test/front.jpg", "https://cdn.example.test/detail.jpg", "https://cdn.example.test/package.jpg"],
      aspectRatio: "9:16",
      durationSeconds: 5,
      creativePlan: plan
    });

    expect(provider.supportsMultiImage()).toBe(true);
    expect(result).toEqual({ ok: true, task: { id: "ark-task-1", model: "ark:seedance-test" } });
    const body = JSON.parse(String(requestInit?.body)) as { content: Array<{ image_url?: { url: string } }>; generate_audio: boolean };
    expect(body.content.slice(1).map((item) => item.image_url?.url)).toEqual(["https://cdn.example.test/front.jpg", "https://cdn.example.test/detail.jpg", "https://cdn.example.test/package.jpg"]);
    expect(body.generate_audio).toBe(false);
  });
});
