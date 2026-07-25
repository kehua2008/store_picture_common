export type VideoAudioMode = "none" | "tts";
export type VideoMusicMode = "none" | "library" | "native";
export type VideoCaptionMode = "none" | "burned";

export type ProductPresentation = {
  productType: string;
  scale: "portable" | "large" | "unknown";
  handInteraction: "recommended" | "conditional" | "avoid";
  preferredApproaches: string[];
  forbiddenApproaches: string[];
};

export type ProductProfile = {
  title: string;
  identityFacts: string[];
  visualFacts: string[];
  forbiddenChanges: string[];
  presentation: ProductPresentation;
  sourceImageCount: number;
  verified: boolean;
};

export type VideoScene = {
  id: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
  purpose: string;
  requiredProductFacts: string[];
  /**
   * Only used when the multi-image provider is unavailable. It is deliberately
   * not part of the user-facing script or scene presentation.
   */
  fallbackReferenceIndex?: number;
  visualPrompt: string;
  narration: string;
  caption: string;
};

export type VideoCreativePlan = {
  version: 1;
  brief: string;
  durationSeconds: number;
  productProfile: ProductProfile;
  scenes: VideoScene[];
  callToAction: string;
  audioMode: VideoAudioMode;
  musicMode: VideoMusicMode;
  captionMode: VideoCaptionMode;
};

export type VideoPlanInput = {
  brief?: string;
  durationSeconds: number;
  imageCount: number;
  category?: string;
  videoGoal?: string;
  platform?: string;
  musicMode?: string;
  voiceoverMode?: string;
  subtitleMode?: string;
};

export function migrateStoredVideoGoal(value: string | undefined, draftVersion: number | undefined): string | undefined {
  return draftVersion === 2 || value !== "handDemo" ? value : "aiSmart";
}

const identityRule = "严格保持商品外形、颜色、材质、包装、可见结构与标签位置一致；不新增不存在的功能、配件、品牌、价格、认证或文字。";

export function buildFallbackVideoCreativePlan(input: VideoPlanInput): VideoCreativePlan {
  const durationSeconds = normalizeDuration(input.durationSeconds);
  const imageCount = Math.max(1, Math.min(6, Math.trunc(input.imageCount) || 1));
  const sceneCount = Math.ceil(durationSeconds / 5);
  const brief = input.brief?.trim() || "生成一条真实、清晰、适合电商投放的商品短视频。";
  const goal = input.videoGoal?.trim() || "商品亮相";
  const platform = input.platform?.trim() || "电商通用";
  const handPresentationRule = presentationRuleForGoal(goal);
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const startSeconds = index * 5;
    const endSeconds = Math.min(durationSeconds, startSeconds + 5);
    const last = index === sceneCount - 1;
    const purpose = index === 0 ? "首屏快速识别商品" : last ? "真实使用场景与行动召唤" : "展示一个可见细节或真实使用价值";
    const narration = index === 0
      ? "一眼看清，真实商品就是主角。"
      : last
        ? "看清细节，马上把它带回日常生活。"
        : "把真实细节和使用感受，讲得清楚一点。";
    const caption = index === 0 ? "真实商品，第一眼看清" : last ? "看清细节，立即了解" : "真实细节，自然呈现";
    return {
      id: `scene-${index + 1}`,
      index,
      startSeconds,
      endSeconds,
      purpose,
      requiredProductFacts: index === 0
        ? ["商品整体外观", "主色与可见结构"]
        : last
          ? ["真实使用场景", "商品整体外观"]
          : ["可确认的材质、结构或包装细节"],
      visualPrompt: [
        `这是第 ${index + 1} 段（${startSeconds}-${endSeconds} 秒），目标：${purpose}。`,
        "所有已上传图片共同定义同一个真实商品的外观、细节与包装；图片没有先后顺序。",
        identityRule,
        `围绕“${goal}”完成一个完整、单一的镜头动作，画面符合${platform}短视频观看习惯。`,
        handPresentationRule,
        index === 0 ? "开场即给商品清晰主视觉，镜头平稳推进，不快速切换多个场景。" : last ? "在真实、克制的生活场景中收束，商品清晰可见并保留干净结尾。" : "用一个稳定的细节扫拍展示可确认卖点；未确认商品适合操作前，不加入手部互动。"
      ].join("\n"),
      narration,
      caption
    };
  });
  return {
    version: 1,
    brief,
    durationSeconds,
    productProfile: {
      title: input.category?.trim() || "已上传商品",
      identityFacts: ["以全部已上传商品图作为真实性依据", "商品外观与包装保持一致"],
      visualFacts: ["全部商品图共同构成同一商品的多视角事实包，用于锁定外观、细节与包装"],
      forbiddenChanges: [identityRule],
      presentation: fallbackPresentation(input.category),
      sourceImageCount: imageCount,
      verified: false
    },
    scenes,
    callToAction: "看清真实商品细节，立即了解。",
    audioMode: toAudioMode(input.voiceoverMode),
    musicMode: toMusicMode(input.musicMode),
    captionMode: toCaptionMode(input.subtitleMode)
  };
}

export function normalizeVideoCreativePlan(candidate: unknown, input: VideoPlanInput): VideoCreativePlan {
  const fallback = buildFallbackVideoCreativePlan(input);
  if (!candidate || typeof candidate !== "object") return fallback;
  const raw = candidate as Partial<VideoCreativePlan>;
  const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (scenes.length !== fallback.scenes.length) return fallback;
  return {
    ...fallback,
    brief: stringOr(raw.brief, fallback.brief, 2_000),
    callToAction: stringOr(raw.callToAction, fallback.callToAction, 160),
    productProfile: normalizeProfile(raw.productProfile, fallback.productProfile),
    scenes: fallback.scenes.map((base, index) => normalizeScene(scenes[index], base, fallback.productProfile.sourceImageCount)),
    audioMode: raw.audioMode === "tts" || raw.audioMode === "none" ? raw.audioMode : fallback.audioMode,
    musicMode: raw.musicMode === "library" || raw.musicMode === "native" || raw.musicMode === "none" ? raw.musicMode : fallback.musicMode,
    captionMode: raw.captionMode === "burned" || raw.captionMode === "none" ? raw.captionMode : fallback.captionMode
  };
}

export function scriptFromVideoCreativePlan(plan: VideoCreativePlan): string {
  return [
    `视频目标：${plan.brief}`,
    `产品事实：${plan.productProfile.identityFacts.join("；")}`,
    `真实性限制：${plan.productProfile.forbiddenChanges.join("；")}`,
    ...plan.scenes.map((scene) => [
      `${scene.index + 1}. [${scene.startSeconds}s-${scene.endSeconds}s] ${scene.purpose}`,
      `本段商品重点：${scene.requiredProductFacts.join("；")}`,
      `画面：${scene.visualPrompt}`,
      `配音：${scene.narration || "无"}`,
      `字幕：${scene.caption || "无"}`
    ].join("\n")),
    `行动召唤：${plan.callToAction}`
  ].join("\n\n");
}

export function videoScenePrompt(scene: VideoScene, profile: ProductProfile): string {
  return [
    "电商商品短视频，真实商品保真优先。",
    `商品事实：${[...profile.identityFacts, ...profile.visualFacts].join("；")}`,
    `禁止改写：${profile.forbiddenChanges.join("；")}`,
    `展示策略：商品类型=${profile.presentation.productType}；体量=${profile.presentation.scale}；手部互动=${profile.presentation.handInteraction}；优先=${profile.presentation.preferredApproaches.join("、")}；禁止=${profile.presentation.forbiddenApproaches.join("、")}`,
    `本段需准确呈现：${scene.requiredProductFacts.join("；")}`,
    "所有参考图属于同一商品的不同角度与细节，必须综合理解，不按图片顺序切换商品或场景。",
    scene.visualPrompt,
    "不要出现水印、二维码、价格、第三方品牌或无法由素材支持的文字。"
  ].join("\n");
}

function normalizeProfile(raw: unknown, fallback: ProductProfile): ProductProfile {
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as Partial<ProductProfile>;
  return {
    title: stringOr(candidate.title, fallback.title, 120),
    identityFacts: stringArray(candidate.identityFacts, fallback.identityFacts),
    visualFacts: stringArray(candidate.visualFacts, fallback.visualFacts),
    forbiddenChanges: stringArray(candidate.forbiddenChanges, fallback.forbiddenChanges),
    presentation: normalizePresentation(candidate.presentation, fallback.presentation),
    sourceImageCount: fallback.sourceImageCount,
    verified: Boolean(candidate.verified)
  };
}

function normalizeScene(raw: unknown, fallback: VideoScene, imageCount: number): VideoScene {
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as Partial<VideoScene>;
  return {
    ...fallback,
    purpose: stringOr(candidate.purpose, fallback.purpose, 200),
    requiredProductFacts: stringArray(candidate.requiredProductFacts, fallback.requiredProductFacts),
    fallbackReferenceIndex: Number.isInteger(candidate.fallbackReferenceIndex) ? Math.max(0, Math.min(imageCount - 1, Number(candidate.fallbackReferenceIndex))) : undefined,
    visualPrompt: stringOr(candidate.visualPrompt, fallback.visualPrompt, 2_500),
    narration: stringOr(candidate.narration, fallback.narration, 160),
    caption: stringOr(candidate.caption, fallback.caption, 100)
  };
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().slice(0, 200)).slice(0, 8);
  return items.length ? items : fallback;
}
function fallbackPresentation(category: string | undefined): ProductPresentation {
  return {
    productType: category?.trim() || "待识别商品",
    scale: "unknown",
    handInteraction: "avoid",
    preferredApproaches: ["无人物商品亮相", "结构与材质细节扫拍", "与商品事实一致的真实场景"],
    forbiddenApproaches: ["未确认可手持或操作时的手部互动", "不符合商品体量的拿起或摆弄动作"]
  };
}
function normalizePresentation(raw: unknown, fallback: ProductPresentation): ProductPresentation {
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as Partial<ProductPresentation>;
  return {
    productType: stringOr(candidate.productType, fallback.productType, 120),
    scale: candidate.scale === "portable" || candidate.scale === "large" || candidate.scale === "unknown" ? candidate.scale : fallback.scale,
    handInteraction: candidate.handInteraction === "recommended" || candidate.handInteraction === "conditional" || candidate.handInteraction === "avoid" ? candidate.handInteraction : fallback.handInteraction,
    preferredApproaches: stringArray(candidate.preferredApproaches, fallback.preferredApproaches),
    forbiddenApproaches: stringArray(candidate.forbiddenApproaches, fallback.forbiddenApproaches)
  };
}
function presentationRuleForGoal(goal: string): string {
  if (/手持/.test(goal)) return "用户明确偏好手持或操作演示；仅当商品的体量与结构确实允许时使用手部互动。大型商品改用手部尺度、局部控制或真实使用场景，绝不伪造成可被拿起的物品。";
  if (/智能判断/.test(goal)) return "先根据全部商品图识别商品类别、体量和可操作性，再决定展示方式。默认无人物商品亮相与细节扫拍；只有便携且操作能证明真实卖点时才使用手部互动。";
  return "镜头必须符合商品实际体量和可操作性；没有图片依据时不加入手部互动。";
}
function stringOr(value: unknown, fallback: string, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback; }
function normalizeDuration(value: number) { return Math.max(5, Math.min(15, Math.trunc(value) || 5)); }
function toAudioMode(value: string | undefined): VideoAudioMode { return /配音/.test(value ?? "") && !/不需要/.test(value ?? "") ? "tts" : "none"; }
function toMusicMode(value: string | undefined): VideoMusicMode { return /自动配乐/.test(value ?? "") ? "library" : "none"; }
function toCaptionMode(value: string | undefined): VideoCaptionMode { return /字幕/.test(value ?? "") && !/无字幕/.test(value ?? "") ? "burned" : "none"; }
