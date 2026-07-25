import { describe, expect, it } from "vitest";
import { buildFallbackVideoCreativePlan, migrateStoredVideoGoal, normalizeVideoCreativePlan, scriptFromVideoCreativePlan, videoScenePrompt } from "../../src/domain/video/videoCreativePlan";

describe("video creative plan", () => {
  it("keeps five-second rendering slices behind a director-controlled full-video timeline", () => {
    const plan = buildFallbackVideoCreativePlan({ brief: "出租车引流短片", durationSeconds: 15, imageCount: 6, category: "汽车服务", videoGoal: "商品亮相", platform: "抖音", voiceoverMode: "按文案配音", subtitleMode: "AI生成字幕" });
    expect(plan.scenes).toHaveLength(3);
    expect(plan.scenes.map((scene) => [scene.startSeconds, scene.endSeconds])).toEqual([[0, 5], [5, 10], [10, 15]]);
    expect(plan.scenes.every((scene) => scene.endSeconds - scene.startSeconds <= 5)).toBe(true);
    expect(plan.directorBeats[0]?.startSeconds).toBe(0);
    expect(plan.directorBeats.at(-1)?.endSeconds).toBe(15);
    expect(plan.directorBeats.length).toBeGreaterThan(3);
    expect(plan.audioMode).toBe("tts");
    expect(plan.captionMode).toBe("burned");
  });

  it("keeps all images as one fact package without exposing or sequencing source images", () => {
    const fallback = buildFallbackVideoCreativePlan({ durationSeconds: 10, imageCount: 2 });
    const plan = normalizeVideoCreativePlan({ ...fallback, productProfile: { ...fallback.productProfile, identityFacts: ["白色保温杯", "金属杯盖"] } }, { durationSeconds: 10, imageCount: 2 });
    expect(plan.productProfile.identityFacts).toEqual(["白色保温杯", "金属杯盖"]);
    const script = scriptFromVideoCreativePlan(plan);
    expect(script).toContain("白色保温杯");
    expect(script).not.toMatch(/素材\s*\d|第\s*\d\s*张/);
    expect(plan.scenes.every((scene) => scene.visualPrompt.includes("图片没有先后顺序"))).toBe(true);
  });

  it("preserves the native music mode selected by an audio-capable provider", () => {
    const fallback = buildFallbackVideoCreativePlan({ durationSeconds: 5, imageCount: 1 });
    const plan = normalizeVideoCreativePlan({ ...fallback, musicMode: "native" }, { durationSeconds: 5, imageCount: 1 });
    expect(plan.musicMode).toBe("native");
  });

  it("keeps an auto-detected large product out of false hand-held scenes", () => {
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 4, category: "汽车服务", videoGoal: "AI智能判断" });
    const prompt = plan.scenes.map((scene) => videoScenePrompt(scene, plan.productProfile)).join("\n");
    expect(prompt).not.toContain("手持演示");
    expect(prompt).not.toContain("拿起商品");
    expect(prompt).toContain("默认无人物商品亮相与细节扫拍");
    expect(plan.productProfile.presentation.handInteraction).toBe("avoid");
  });

  it("keeps a manual hand-demo request conditional on the actual product scale", () => {
    const plan = buildFallbackVideoCreativePlan({ durationSeconds: 5, imageCount: 1, category: "汽车服务", videoGoal: "手持演示" });
    expect(plan.scenes[0]?.visualPrompt).toContain("用户明确偏好手持或操作演示");
    expect(plan.scenes[0]?.visualPrompt).toContain("绝不伪造成可被拿起的物品");
  });

  it("migrates the legacy default hand-demo draft while preserving explicit modern choices", () => {
    expect(migrateStoredVideoGoal("handDemo", undefined)).toBe("aiSmart");
    expect(migrateStoredVideoGoal("handDemo", 2)).toBe("handDemo");
    expect(migrateStoredVideoGoal("detailSweep", undefined)).toBe("detailSweep");
  });

  it("compiles free-form beats that cross a render boundary into the correct backend prompts", () => {
    const fallback = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 3, brief: "汽车接送服务" });
    const plan = normalizeVideoCreativePlan({
      ...fallback,
      directorBeats: [
        { startSeconds: 0, endSeconds: 2.2, visualSubject: "车辆外观", cameraMovement: "低机位推近", action: "展现车身比例", narration: "", caption: "" },
        { startSeconds: 2.2, endSeconds: 7.4, visualSubject: "车内空间", cameraMovement: "平稳横移", action: "展示座舱和座椅", narration: "", caption: "空间舒适" },
        { startSeconds: 7.4, endSeconds: 11.1, visualSubject: "商务接送场景", cameraMovement: "跟随镜头", action: "车辆平稳抵达", narration: "", caption: "" },
        { startSeconds: 11.1, endSeconds: 15, visualSubject: "城市道路行驶", cameraMovement: "广角侧移", action: "呈现稳定出行", narration: "", caption: "安心出行" }
      ]
    }, { durationSeconds: 15, imageCount: 3, brief: "汽车接送服务" });
    expect(plan.directorBeats.map((beat) => [beat.startSeconds, beat.endSeconds])).toEqual([[0, 2.2], [2.2, 7.4], [7.4, 11.1], [11.1, 15]]);
    expect(plan.scenes[0]?.visualPrompt).toContain("全片 2.2秒-5秒");
    expect(plan.scenes[1]?.visualPrompt).toContain("全片 5秒-7.4秒");
    expect(scriptFromVideoCreativePlan(plan)).toContain("低机位推近");
  });

  it("uses varied safe fallback director rhythms instead of a fixed three-part template", () => {
    const car = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 2, brief: "城市出租车服务", category: "汽车服务", platform: "抖音" });
    const cup = buildFallbackVideoCreativePlan({ durationSeconds: 15, imageCount: 2, brief: "保温杯礼盒展示", category: "家居用品", platform: "小红书" });
    expect(car.directorBeats.map((beat) => beat.action)).not.toEqual(cup.directorBeats.map((beat) => beat.action));
    expect(scriptFromVideoCreativePlan(car)).not.toContain("首屏快速识别商品");
    expect(scriptFromVideoCreativePlan(car)).not.toContain("行动召唤：");
  });
});
