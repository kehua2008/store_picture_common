import { describe, expect, it } from "vitest";
import { buildFallbackVideoCreativePlan, normalizeVideoCreativePlan, scriptFromVideoCreativePlan } from "../../src/domain/video/videoCreativePlan";

describe("video creative plan", () => {
  it("splits a fifteen second brief into three executable five-second scenes", () => {
    const plan = buildFallbackVideoCreativePlan({ brief: "出租车引流短片", durationSeconds: 15, imageCount: 6, category: "汽车服务", videoGoal: "商品亮相", platform: "抖音", voiceoverMode: "按文案配音", subtitleMode: "AI生成字幕" });
    expect(plan.scenes).toHaveLength(3);
    expect(plan.scenes.map((scene) => [scene.startSeconds, scene.endSeconds])).toEqual([[0, 5], [5, 10], [10, 15]]);
    expect(plan.scenes.every((scene) => scene.endSeconds - scene.startSeconds <= 5)).toBe(true);
    expect(plan.audioMode).toBe("tts");
    expect(plan.captionMode).toBe("burned");
  });

  it("keeps an uploaded product profile while clamping scene anchors to available images", () => {
    const fallback = buildFallbackVideoCreativePlan({ durationSeconds: 10, imageCount: 2 });
    const plan = normalizeVideoCreativePlan({ ...fallback, productProfile: { ...fallback.productProfile, identityFacts: ["白色保温杯", "金属杯盖"] }, scenes: fallback.scenes.map((scene, index) => ({ ...scene, anchorImageIndex: index + 9 })) }, { durationSeconds: 10, imageCount: 2 });
    expect(plan.productProfile.identityFacts).toEqual(["白色保温杯", "金属杯盖"]);
    expect(plan.scenes.map((scene) => scene.anchorImageIndex)).toEqual([1, 1]);
    expect(scriptFromVideoCreativePlan(plan)).toContain("白色保温杯");
  });

  it("preserves the native music mode selected by an audio-capable provider", () => {
    const fallback = buildFallbackVideoCreativePlan({ durationSeconds: 5, imageCount: 1 });
    const plan = normalizeVideoCreativePlan({ ...fallback, musicMode: "native" }, { durationSeconds: 5, imageCount: 1 });
    expect(plan.musicMode).toBe("native");
  });
});
