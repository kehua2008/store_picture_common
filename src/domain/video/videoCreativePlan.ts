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

export type DirectorBeat = {
  id: string;
  index: number;
  startSeconds: number;
  endSeconds: number;
  visualSubject: string;
  cameraMovement: string;
  action: string;
  narration: string;
  caption: string;
};

export type VideoCreativePlan = {
  version: 1;
  brief: string;
  durationSeconds: number;
  productProfile: ProductProfile;
  directorBeats: DirectorBeat[];
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
  const brief = input.brief?.trim() || "生成一条真实、清晰、适合电商投放的商品短视频。";
  const goal = input.videoGoal?.trim() || "商品亮相";
  const directorBeats = fallbackDirectorBeats({ ...input, durationSeconds, brief, videoGoal: goal });
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
    directorBeats,
    scenes: compileRenderScenes(directorBeats, durationSeconds),
    callToAction: "",
    audioMode: toAudioMode(input.voiceoverMode),
    musicMode: toMusicMode(input.musicMode),
    captionMode: toCaptionMode(input.subtitleMode)
  };
}

export function normalizeVideoCreativePlan(candidate: unknown, input: VideoPlanInput): VideoCreativePlan {
  const fallback = buildFallbackVideoCreativePlan(input);
  if (!candidate || typeof candidate !== "object") return fallback;
  const raw = candidate as Partial<VideoCreativePlan>;
  const directorBeats = normalizeDirectorBeats(raw.directorBeats, fallback.directorBeats, fallback.durationSeconds);
  return {
    ...fallback,
    brief: stringOr(raw.brief, fallback.brief, 2_000),
    callToAction: stringOr(raw.callToAction, fallback.callToAction, 160),
    productProfile: normalizeProfile(raw.productProfile, fallback.productProfile),
    directorBeats,
    scenes: compileRenderScenes(directorBeats, fallback.durationSeconds),
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
    `声音与字幕：背景音乐${plan.musicMode === "none" ? "无" : plan.musicMode === "native" ? "AI自动配乐" : "音乐库配乐"}；配音${plan.audioMode === "tts" ? "按导演文案配音" : "无"}；字幕${plan.captionMode === "burned" ? "按导演节拍生成" : "无"}`,
    ...plan.directorBeats.map((beat) => [
      `${beat.index + 1}. [${formatSeconds(beat.startSeconds)}-${formatSeconds(beat.endSeconds)}]`,
      `主体：${beat.visualSubject}`,
      `运镜：${beat.cameraMovement}`,
      `动作：${beat.action}`,
      `配音：${beat.narration || "无"}`,
      `字幕：${beat.caption || "无"}`
    ].join("\n")),
    plan.callToAction ? `行动召唤：${plan.callToAction}` : undefined
  ].filter(Boolean).join("\n\n");
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

function normalizeDirectorBeats(raw: unknown, fallback: DirectorBeat[], durationSeconds: number): DirectorBeat[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 8) return fallback;
  const parsed = raw.map((value, index) => normalizeDirectorBeat(value, index)).filter((value): value is DirectorBeat => Boolean(value)).sort((a, b) => a.startSeconds - b.startSeconds);
  if (!parsed.length || parsed[0]!.startSeconds > 0.15 || Math.abs(parsed.at(-1)!.endSeconds - durationSeconds) > 0.15) return fallback;
  for (let index = 0; index < parsed.length; index += 1) {
    const beat = parsed[index]!;
    const previous = parsed[index - 1];
    if (beat.endSeconds <= beat.startSeconds || beat.endSeconds - beat.startSeconds < 0.4 || beat.endSeconds > durationSeconds + 0.15 || (previous && Math.abs(previous.endSeconds - beat.startSeconds) > 0.2)) return fallback;
  }
  return parsed.map((beat, index) => ({ ...beat, id: `beat-${index + 1}`, index, startSeconds: roundTime(index === 0 ? 0 : beat.startSeconds), endSeconds: roundTime(index === parsed.length - 1 ? durationSeconds : beat.endSeconds) }));
}

function normalizeDirectorBeat(raw: unknown, index: number): DirectorBeat | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Partial<DirectorBeat>;
  const startSeconds = finiteNumber(candidate.startSeconds);
  const endSeconds = finiteNumber(candidate.endSeconds);
  if (startSeconds === undefined || endSeconds === undefined) return undefined;
  const visualSubject = nonEmptyText(candidate.visualSubject, 240);
  const cameraMovement = nonEmptyText(candidate.cameraMovement, 240);
  const action = nonEmptyText(candidate.action, 400);
  if (!visualSubject || !cameraMovement || !action) return undefined;
  return { id: `beat-${index + 1}`, index, startSeconds, endSeconds, visualSubject, cameraMovement, action, narration: textOrEmpty(candidate.narration, 160), caption: textOrEmpty(candidate.caption, 100) };
}

function compileRenderScenes(beats: DirectorBeat[], durationSeconds: number): VideoScene[] {
  const sceneCount = Math.ceil(durationSeconds / 5);
  return Array.from({ length: sceneCount }, (_, index) => {
    const startSeconds = index * 5;
    const endSeconds = Math.min(durationSeconds, startSeconds + 5);
    const relevantBeats = beats.filter((beat) => beat.endSeconds > startSeconds && beat.startSeconds < endSeconds);
    const timeline = relevantBeats.map((beat) => {
      const visibleStart = Math.max(beat.startSeconds, startSeconds);
      const visibleEnd = Math.min(beat.endSeconds, endSeconds);
      return `[全片 ${formatSeconds(visibleStart)}-${formatSeconds(visibleEnd)}] 主体：${beat.visualSubject}；运镜：${beat.cameraMovement}；动作：${beat.action}`;
    });
    return {
      id: `render-segment-${index + 1}`,
      index,
      startSeconds,
      endSeconds,
      purpose: relevantBeats.map((beat) => beat.visualSubject).join("；") || "按导演时间线生成",
      requiredProductFacts: ["商品身份、外形、颜色、材质与可确认细节"],
      visualPrompt: [
        `这是后台渲染片段（全片 ${formatSeconds(startSeconds)}-${formatSeconds(endSeconds)}），必须连续衔接导演时间线。`,
        "所有已上传图片共同定义同一个真实商品的外观、细节与包装；图片没有先后顺序。",
        identityRule,
        ...timeline,
        "仅呈现本时间范围内的导演节拍；不擅自补充固定的商品亮相、细节、场景或行动召唤结构。"
      ].join("\n"),
      narration: relevantBeats.map((beat) => beat.narration).filter(Boolean).join("。"),
      caption: relevantBeats.map((beat) => beat.caption).filter(Boolean).join(" / ")
    };
  });
}

function fallbackDirectorBeats(input: VideoPlanInput & { brief: string; videoGoal: string }): DirectorBeat[] {
  const choices = [
    ["商品轮廓与环境关系", "平稳推近", "从干净构图自然推进，保留商品真实比例", "真实商品，自然呈现"],
    ["可确认的结构与材质", "微距横移", "沿可见结构缓慢扫过，不补充图片中不存在的功能", "细节经得起看"],
    ["商品在可信场景中的状态", "低速侧移", "让商品与真实环境产生自然关系，不强行加入人物或操作", "真实场景，更有代入感"],
    ["商品整体与局部呼应", "由近及远", "从局部回到整体，保持干净、克制的收束", "看见完整细节"],
    ["产品表面与空间层次", "稳定环绕", "以稳定镜头表现轮廓、材质和可见空间层次", "清晰呈现每一处"],
    ["商品的静态美感", "缓慢俯仰", "以单一连续动作建立画面节奏，不编造使用动作", "让商品自己说话"]
  ];
  const seed = stableHash(`${input.brief}|${input.category ?? ""}|${input.videoGoal}|${input.platform ?? ""}`);
  const count = input.durationSeconds <= 5 ? 2 : input.durationSeconds <= 10 ? 3 : 4 + seed % 2;
  const weights = [0.22, 0.18, 0.26, 0.16, 0.18, 0.2];
  const selected = Array.from({ length: count }, (_, index) => choices[(seed + index * 3) % choices.length]!);
  const selectedWeights = selected.map((_, index) => weights[(seed + index) % weights.length]!);
  const total = selectedWeights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return selected.map((choice, index) => {
    const startSeconds = roundTime(cursor);
    const endSeconds = index === selected.length - 1 ? input.durationSeconds : roundTime(cursor + input.durationSeconds * (selectedWeights[index]! / total));
    cursor = endSeconds;
    return { id: `beat-${index + 1}`, index, startSeconds, endSeconds, visualSubject: `${input.category?.trim() || "商品"}的${choice[0]}`, cameraMovement: choice[1], action: `围绕用户需求“${input.brief.slice(0, 120)}”执行：${choice[2]}。${presentationRuleForGoal(input.videoGoal)}`, narration: "", caption: choice[3] };
  });
}

function stableHash(value: string) { return [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7); }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : undefined; }
function nonEmptyText(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
function textOrEmpty(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function roundTime(value: number) { return Math.round(value * 10) / 10; }
function formatSeconds(value: number) { return `${Number.isInteger(value) ? value : value.toFixed(1)}秒`; }

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
