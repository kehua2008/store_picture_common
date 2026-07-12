"use client";

import Link from "next/link";
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useState } from "react";
import {
  buildCommonPrompt,
  categories,
  strengths,
  styles,
  suites,
  tasks,
  type CategoryId,
  type StrengthId,
  type StyleId,
  type SuiteId,
  type TaskId
} from "../src/domain/common/promptMatrix";

type PortalView = "home" | "choice" | "image" | "video";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  previewUrl: string;
};

type CurrentUser = {
  id: string;
  phone: string;
  displayName?: string;
  companyName?: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
};

type SessionActorView = {
  actorId: string;
  actorName: string;
};

type CreditAccountView = {
  customerId: string;
  balanceCredits: number;
  frozenCredits: number;
  updatedAt?: string;
};

type UserJobView = {
  id: string;
  status?: string;
  createdAt?: string;
  results?: unknown[];
};

type OptimizedAsset = {
  avif: string;
  webp: string;
  fallback: string;
  sizes: string;
};

type VideoGoalId = "productReveal" | "handDemo" | "usageScene" | "detailSweep" | "unboxing" | "liveClip";
type VideoPlatformId = "douyin" | "xiaohongshu" | "kuaishou" | "wechat" | "marketplace";
type VideoRhythmId = "steady" | "balanced" | "impact";
type VideoCreationMode = "choose" | "reference" | "prompt";
type CommercePlatformId = "taobao" | "tmall" | "jd" | "pdd" | "douyin" | "free" | "amazon" | "shopee" | "lazada";
type ImageSpecId = "square_main" | "portrait_main" | "white_main" | "detail_long" | "social_cover" | "custom";
type ImageTypeId = "scene_main" | "white_main" | "detail_closeup" | "benefit_base" | "sku_set" | "usage_demo";

const defaultTask: TaskId = "sceneHero";
const defaultCategory: CategoryId = "general";
const defaultStyle: StyleId = "modernHome";
const defaultStrength: StrengthId = "balanced";
const defaultSuite: SuiteId = "listing";

const optimizedAssets = {
  hero: {
    avif: "/homepage-assets/optimized/common-home-entry-poster-480w.avif 480w, /homepage-assets/optimized/common-home-entry-poster-800w.avif 800w, /homepage-assets/optimized/common-home-entry-poster-1200w.avif 1200w",
    webp: "/homepage-assets/optimized/common-home-entry-poster-480w.webp 480w, /homepage-assets/optimized/common-home-entry-poster-800w.webp 800w, /homepage-assets/optimized/common-home-entry-poster-1200w.webp 1200w",
    fallback: "/homepage-assets/optimized/common-home-entry-poster-1200w.webp",
    sizes: "(max-width: 760px) 100vw, 44vw"
  },
  choiceImage: {
    avif: "/homepage-assets/optimized/common-choice-image-420w.avif 420w, /homepage-assets/optimized/common-choice-image-760w.avif 760w, /homepage-assets/optimized/common-choice-image-1100w.avif 1100w",
    webp: "/homepage-assets/optimized/common-choice-image-420w.webp 420w, /homepage-assets/optimized/common-choice-image-760w.webp 760w, /homepage-assets/optimized/common-choice-image-1100w.webp 1100w",
    fallback: "/homepage-assets/optimized/common-choice-image-760w.webp",
    sizes: "(max-width: 1180px) calc(100vw - 76px), 475px"
  },
  choiceVideo: {
    avif: "/homepage-assets/optimized/common-choice-video-420w.avif 420w, /homepage-assets/optimized/common-choice-video-760w.avif 760w, /homepage-assets/optimized/common-choice-video-1100w.avif 1100w",
    webp: "/homepage-assets/optimized/common-choice-video-420w.webp 420w, /homepage-assets/optimized/common-choice-video-760w.webp 760w, /homepage-assets/optimized/common-choice-video-1100w.webp 1100w",
    fallback: "/homepage-assets/optimized/common-choice-video-760w.webp",
    sizes: "(max-width: 1180px) calc(100vw - 76px), 475px"
  },
  videoReference: {
    avif: "/video-choice-assets/optimized/common-video-choice-reference-blue-420w.avif 420w, /video-choice-assets/optimized/common-video-choice-reference-blue-760w.avif 760w, /video-choice-assets/optimized/common-video-choice-reference-blue-1100w.avif 1100w",
    webp: "/video-choice-assets/optimized/common-video-choice-reference-blue-420w.webp 420w, /video-choice-assets/optimized/common-video-choice-reference-blue-760w.webp 760w, /video-choice-assets/optimized/common-video-choice-reference-blue-1100w.webp 1100w",
    fallback: "/video-choice-assets/optimized/common-video-choice-reference-blue-760w.webp",
    sizes: "(max-width: 1180px) calc(100vw - 76px), 478px"
  },
  videoPrompt: {
    avif: "/video-choice-assets/optimized/common-video-choice-prompt-blue-420w.avif 420w, /video-choice-assets/optimized/common-video-choice-prompt-blue-760w.avif 760w, /video-choice-assets/optimized/common-video-choice-prompt-blue-1100w.avif 1100w",
    webp: "/video-choice-assets/optimized/common-video-choice-prompt-blue-420w.webp 420w, /video-choice-assets/optimized/common-video-choice-prompt-blue-760w.webp 760w, /video-choice-assets/optimized/common-video-choice-prompt-blue-1100w.webp 1100w",
    fallback: "/video-choice-assets/optimized/common-video-choice-prompt-blue-760w.webp",
    sizes: "(max-width: 1180px) calc(100vw - 76px), 478px"
  }
} satisfies Record<string, OptimizedAsset>;

const videoGoals: Array<{ id: VideoGoalId; label: string; desc: string; prompt: string }> = [
  { id: "productReveal", label: "商品亮相", desc: "3秒看清商品", prompt: "start with a clean product reveal, large product in frame, immediate recognition in the first three seconds" },
  { id: "handDemo", label: "手持演示", desc: "拿起、打开、安装、操作", prompt: "show credible hand operation such as holding, opening, placing, installing, switching, pouring or folding, without inventing false features" },
  { id: "usageScene", label: "场景使用", desc: "放进真实生活场景", prompt: "show the product used in a truthful daily-life environment that matches the category and keeps the product readable" },
  { id: "detailSweep", label: "细节扫拍", desc: "材质、结构、包装细节", prompt: "use slow macro sweep shots for material, texture, packaging edge, connector, button, handle, capacity or craftsmanship details" },
  { id: "unboxing", label: "开箱展示", desc: "包装、套装、配件顺序", prompt: "show a clean unboxing sequence with package, included items and product layout, no fake accessories" },
  { id: "liveClip", label: "直播切片", desc: "直观讲解感，适合投流", prompt: "use live-commerce style composition with hand scale, warm trust, direct product demonstration and no loud price graphics" }
];

const videoPlatforms: Array<{ id: VideoPlatformId; label: string; prompt: string }> = [
  { id: "douyin", label: "抖音", prompt: "Douyin commerce rhythm: vertical, strong opening, fast recognition, motion cue, product remains dominant" },
  { id: "xiaohongshu", label: "小红书", prompt: "Xiaohongshu rhythm: tasteful lifestyle seeding, soft natural light, save-worthy composition, not hard-sell" },
  { id: "kuaishou", label: "快手", prompt: "Kuaishou rhythm: direct live-commerce trust, warm real-use scene, clear demonstration" },
  { id: "wechat", label: "视频号", prompt: "Channels rhythm: restrained social-commerce trust, calm clean scene, credible product detail" },
  { id: "marketplace", label: "电商通用", prompt: "General marketplace video: product clarity, truthful function, clean transitions, reusable product asset" }
];

const videoRhythms: Array<{ id: VideoRhythmId; label: string; desc: string; prompt: string }> = [
  { id: "steady", label: "稳妥", desc: "审核友好，动作慢一点", prompt: "steady pace, simple camera movement, audit-friendly, no exaggerated claims" },
  { id: "balanced", label: "平衡", desc: "默认推荐，清楚又有转化", prompt: "balanced pace, clear sequence, useful visual variety, product identity locked" },
  { id: "impact", label: "强首屏", desc: "适合投流封面和短视频", prompt: "strong opening frame, tighter cuts, stronger depth and light, still truthful and product-first" }
];

const videoSpecOptions = [
  { id: "vertical", label: "竖屏", spec: "9:16 · ≤15s" },
  { id: "portrait_4_5", label: "竖版", spec: "4:5 · ≤15s" },
  { id: "ecommerce_3_4", label: "电商竖版", spec: "3:4 · ≤15s" },
  { id: "square", label: "方形", spec: "1:1 · ≤15s" },
  { id: "horizontal", label: "横屏", spec: "16:9 · ≤15s" },
  { id: "custom", label: "自定义", spec: "自定义比例 · ≤15s" }
] as const;

const referenceModeOptions = [
  { id: "light", label: "轻度参考", desc: "更自由，主要借鉴画面感觉" },
  { id: "medium", label: "中度参考（推荐）", desc: "平衡相似度和原创度" },
  { id: "strong", label: "重度参考", desc: "更贴近参考视频的节奏和动作" }
] as const;

const commonVideoGoals = ["换成我的商品", "换背景但保留氛围", "保留节奏，重写文案", "生成投放感字幕"];
const musicModeOptions = ["AI自动配乐", "上传本地音乐", "粘贴音乐链接", "不需要背景音乐"];
const voiceoverModeOptions = ["不需要配音", "AI自主配音", "按文案配音", "上传配音音频"];
const subtitleModeOptions = ["无字幕", "AI生成字幕", "按文案生成字幕"];
const directVideoQualities = [
  { id: "480p", label: "480P", desc: "推荐先生成，试片成本更低" },
  { id: "720p", label: "720P", desc: "更清晰，适合确认后直接导出" }
] as const;
const upscaleVideoQualities = [
  { id: "1080p", label: "1080P" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K" }
] as const;
const videoDurationOptions = [
  { id: "5", label: "5秒", desc: "最低试片成本" },
  { id: "10", label: "10秒", desc: "常规短草稿" },
  { id: "15", label: "15秒", desc: "完整卖点节奏" },
  { id: "custom", label: "自定义（≤15秒）", desc: "1-15秒整数" }
] as const;

const commonCategoryGroups: Array<{ id: string; label: string; desc: string; mark: string; categories: CategoryId[] }> = [
  { id: "home", label: "家居生活", desc: "日用、家纺、收纳清洁", mark: "居", categories: ["homeDaily", "storageCleaning", "officeStationery"] },
  { id: "kitchen", label: "厨房餐饮", desc: "餐厨、水杯、食品礼盒", mark: "厨", categories: ["kitchenDining", "foodGift"] },
  { id: "appliance", label: "数码小电", desc: "小家电、桌面数码、车载", mark: "电", categories: ["digitalAppliance", "autoAccessory"] },
  { id: "life", label: "个护母婴", desc: "个护、美妆、玩具户外", mark: "生", categories: ["beautyPersonal", "babyToy", "sportsOutdoor"] },
  { id: "other", label: "其他", desc: "暂未归类的百货商品", mark: "其", categories: ["general"] }
];

const platformLabels: Record<CommercePlatformId, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  pdd: "拼多多",
  douyin: "抖音电商",
  free: "自由尺寸",
  amazon: "Amazon",
  shopee: "Shopee",
  lazada: "Lazada"
};

const domesticPlatforms: CommercePlatformId[] = ["taobao", "tmall", "jd", "pdd", "douyin"];
const crossBorderPlatforms: CommercePlatformId[] = ["amazon", "shopee", "lazada"];

const commonSpecs: Array<{ id: ImageSpecId; label: string; assetGroup: string; targetWidth: number; targetHeight: number; platforms: CommercePlatformId[] }> = [
  { id: "square_main", label: "平台方图", assetGroup: "主图", targetWidth: 800, targetHeight: 800, platforms: ["taobao", "tmall", "jd", "pdd", "douyin", "amazon", "shopee", "lazada"] },
  { id: "portrait_main", label: "竖版主图", assetGroup: "主图", targetWidth: 900, targetHeight: 1200, platforms: ["taobao", "tmall", "jd", "douyin", "free"] },
  { id: "white_main", label: "白底审核图", assetGroup: "主图", targetWidth: 1000, targetHeight: 1000, platforms: ["taobao", "tmall", "jd", "pdd", "amazon", "shopee", "lazada", "free"] },
  { id: "social_cover", label: "内容封面", assetGroup: "封面", targetWidth: 1080, targetHeight: 1440, platforms: ["douyin", "free"] },
  { id: "detail_long", label: "详情长图", assetGroup: "详情", targetWidth: 790, targetHeight: 1200, platforms: ["taobao", "tmall", "jd", "pdd", "free"] }
];

const commonImageTypes: Array<{ id: ImageTypeId; label: string; desc: string; taskId: TaskId }> = [
  { id: "scene_main", label: "场景主图", desc: "商品放进真实使用场景", taskId: "sceneHero" },
  { id: "white_main", label: "白底主图", desc: "完整清晰，适合平台审核", taskId: "whiteHero" },
  { id: "detail_closeup", label: "细节特写", desc: "材质、结构、包装细节", taskId: "detailCloseup" },
  { id: "benefit_base", label: "卖点底图", desc: "留白便于后期加文案", taskId: "benefitBase" },
  { id: "sku_set", label: "SKU/套装图", desc: "多色多规格整齐展示", taskId: "skuSet" },
  { id: "usage_demo", label: "使用示意", desc: "手持、摆放、安装、打开", taskId: "usageDemo" }
];

const defaultImageTypeCounts: Record<ImageTypeId, number> = {
  scene_main: 1,
  white_main: 0,
  detail_closeup: 0,
  benefit_base: 0,
  sku_set: 0,
  usage_demo: 0
};

const displayProfiles = [
  { id: "product_only", label: "不需要人物", desc: "纯商品、白底、场景摆拍、详情特写", taskId: "sceneHero" as TaskId },
  { id: "hand_demo", label: "手持/操作演示", desc: "手部拿起、打开、安装、收纳、倒取", taskId: "usageDemo" as TaskId },
  { id: "life_scene", label: "生活场景人物", desc: "只保留自然生活氛围，不抢商品", taskId: "usageDemo" as TaskId }
];

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function authErrorMessage(error: unknown): string {
  if (error === "phone_already_registered") return "该手机号已注册，请直接输入密码登录";
  if (error === "invalid_phone") return "手机号格式不正确，请输入 11 位手机号";
  if (error === "invalid_password") return "密码至少 8 位";
  if (error === "invalid_phone_or_password") return "手机号或密码不正确，请核对后再登录";
  if (error === "authentication_required") return "请先登录账号";
  if (typeof error === "string" && error.trim()) return error;
  return "请稍后重试";
}

function fileToUpload(file: File): UploadedFile {
  return {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    size: file.size,
    previewUrl: URL.createObjectURL(file)
  };
}

function buildVideoPrompt(input: {
  categoryId: CategoryId;
  styleId: StyleId;
  goalId: VideoGoalId;
  platformId: VideoPlatformId;
  rhythmId: VideoRhythmId;
  merchantNote?: string;
}) {
  const category = categories.find((item) => item.id === input.categoryId) ?? categories[0];
  const style = styles.find((item) => item.id === input.styleId) ?? styles[0];
  const goal = videoGoals.find((item) => item.id === input.goalId) ?? videoGoals[0];
  const platform = videoPlatforms.find((item) => item.id === input.platformId) ?? videoPlatforms[0];
  const rhythm = videoRhythms.find((item) => item.id === input.rhythmId) ?? videoRhythms[0];
  const note = input.merchantNote?.trim();

  return {
    summary: `${goal.label} / ${category.label} / ${platform.label} / ${rhythm.label}`,
    body: [
      "Create a short ecommerce product video prompt from the uploaded product reference.",
      "Product identity lock: preserve the uploaded product's shape, color, material, packaging, scale, logo/label placement and visible parts. Do not add nonexistent accessories, functions, certifications, claims, text or brand elements.",
      category.prompt,
      style.prompt,
      `Video goal: ${goal.prompt}.`,
      platform.prompt,
      `Rhythm: ${rhythm.prompt}.`,
      "Suggested structure: 1) first-frame product recognition, 2) use or detail proof, 3) clean final product beauty shot. Keep the product visible in every shot.",
      note ? `Merchant note to respect if truthful: ${note}.` : "",
      "Negative constraints: watermark, platform logo, QR code, price graphic, dense subtitles, false function, fake certification, extra accessory, product deformation, color drift, messy background, unsafe hand operation, unreadable generated text."
    ].filter(Boolean).join("\n\n")
  };
}

export default function Home() {
  const [view, setView] = useState<PortalView>("home");
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [videoFiles, setVideoFiles] = useState<UploadedFile[]>([]);
  const [dragTarget, setDragTarget] = useState<"image" | "video" | undefined>();

  const [activeTask, setActiveTask] = useState<TaskId>(defaultTask);
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [style, setStyle] = useState<StyleId>(defaultStyle);
  const [strength, setStrength] = useState<StrengthId>(defaultStrength);
  const [suite, setSuite] = useState<SuiteId>(defaultSuite);
  const [merchantNote, setMerchantNote] = useState("");
  const [copyStatus, setCopyStatus] = useState("提示词随选项实时更新");

  const [videoGoal, setVideoGoal] = useState<VideoGoalId>("handDemo");
  const [videoPlatform, setVideoPlatform] = useState<VideoPlatformId>("douyin");
  const [videoRhythm, setVideoRhythm] = useState<VideoRhythmId>("balanced");
  const [videoCreationMode, setVideoCreationMode] = useState<VideoCreationMode>("choose");
  const [videoNote, setVideoNote] = useState("");
  const [videoCopyStatus, setVideoCopyStatus] = useState("生视频提示词随选项实时更新");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [currentActor, setCurrentActor] = useState<SessionActorView>();
  const [creditAccount, setCreditAccount] = useState<CreditAccountView>();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authActorName, setAuthActorName] = useState("");
  const [authStatus, setAuthStatus] = useState("手机号注册后直接启用，新用户默认 0 积分");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [userJobs, setUserJobs] = useState<UserJobView[]>([]);
  const [userJobsStatus, setUserJobsStatus] = useState("登录后查看近 24 小时生成记录");

  const imagePrompt = useMemo(
    () => buildCommonPrompt({ taskId: activeTask, categoryId: category, styleId: style, strengthId: strength, merchantNote }),
    [activeTask, category, merchantNote, strength, style]
  );

  const videoPrompt = useMemo(
    () => buildVideoPrompt({ categoryId: category, styleId: style, goalId: videoGoal, platformId: videoPlatform, rhythmId: videoRhythm, merchantNote: videoNote }),
    [category, style, videoGoal, videoNote, videoPlatform, videoRhythm]
  );

  const selectedSuite = suites.find((item) => item.id === suite) ?? suites[0];

  useEffect(() => {
    void refreshCurrentUser();
  }, []);

  function enterVideoChoice() {
    setView("video");
    setVideoCreationMode("choose");
  }

  function openUserPanel() {
    setUserPanelOpen(true);
    void refreshCurrentUser();
    void refreshUserJobs();
  }

  async function refreshCurrentUser() {
    const response = await fetch("/api/auth/me").catch(() => undefined);
    if (!response?.ok) {
      setIsLoggedIn(false);
      setCurrentUser(undefined);
      setCurrentActor(undefined);
      setCreditAccount(undefined);
      setUserJobs([]);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setCurrentUser(body.user);
    setCurrentActor(body.actor);
    setCreditAccount(body.account);
    setIsLoggedIn(Boolean(body.user));
  }

  async function refreshUserJobs() {
    const response = await fetch("/api/generation-jobs").catch(() => undefined);
    if (!response?.ok) {
      setUserJobs([]);
      setUserJobsStatus(response?.status === 401 ? "登录后查看近 24 小时生成记录" : "任务列表暂时无法加载");
      return;
    }
    const body = await response.json().catch(() => ({}));
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    setUserJobs(jobs);
    setUserJobsStatus(jobs.length ? "已同步当前账号任务" : "当前账号近 24 小时暂无生成任务");
  }

  async function submitAuth() {
    const phone = authPhone.replace(/\D/g, "").slice(0, 11);
    if (!phone) {
      setAuthStatus("请输入 11 位手机号");
      return;
    }
    if (authPassword.length < 8) {
      setAuthStatus("密码至少 8 位，请重新输入");
      return;
    }
    const response = await fetch(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password: authPassword, actorName: authActorName.trim() })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (body.error === "phone_already_registered") setAuthMode("login");
      setAuthStatus(authErrorMessage(body.error));
      return;
    }
    setCurrentUser(body.user);
    setCurrentActor(body.actor);
    setCreditAccount(body.account);
    setIsLoggedIn(true);
    setAuthStatus(authMode === "register" ? "注册成功，充值审核到账后可生成图片" : "登录成功");
    void refreshUserJobs();
  }

  async function createImageJob() {
    if (!imageFiles.length) {
      setCopyStatus("请先上传商品素材，再点击生成图片");
      return;
    }
    if (!isLoggedIn) {
      setAuthMode("login");
      setUserPanelOpen(true);
      setAuthStatus("请先登录或注册账号，再提交生图任务");
      setCopyStatus("登录后即可提交生图任务");
      return;
    }

    const task = tasks.find((item) => item.id === activeTask);
    const selectedCategory = categories.find((item) => item.id === category);
    setCopyStatus("正在提交生图任务...");
    const response = await fetch("/api/generation-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskLabel: task?.label,
        categoryLabel: selectedCategory?.label,
        promptSummary: imagePrompt.summary,
        promptBody: imagePrompt.body,
        total: selectedSuite.tasks.length
      })
    }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setCopyStatus(`提交失败：${body?.error ? authErrorMessage(body.error) : "请稍后重试"}`);
      if (response?.status === 401) setUserPanelOpen(true);
      return;
    }
    setCopyStatus("生图任务已提交，可到生成记录查看进度");
    void refreshUserJobs();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setIsLoggedIn(false);
    setCurrentUser(undefined);
    setCurrentActor(undefined);
    setCreditAccount(undefined);
    setUserJobs([]);
    setUserPanelOpen(false);
    setAuthStatus("已退出登录，可切换账号");
  }

  function addFiles(selectedFiles: FileList | File[], target: "image" | "video") {
    const acceptedFiles = Array.from(selectedFiles).filter((file) => target === "video" ? file.type.startsWith("image/") || file.type.startsWith("video/") : file.type.startsWith("image/"));
    const uploads = acceptedFiles.map(fileToUpload);
    if (target === "video") setVideoFiles((current) => [...uploads, ...current].slice(0, 10));
    else setImageFiles((current) => [...uploads, ...current].slice(0, 12));
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>, target: "image" | "video") {
    if (event.target.files) addFiles(event.target.files, target);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>, target: "image" | "video") {
    event.preventDefault();
    setDragTarget(undefined);
    addFiles(event.dataTransfer.files, target);
  }

  async function copyText(text: string, onDone: (message: string) => void) {
    await navigator.clipboard.writeText(text);
    onDone("提示词已复制，可接入后端队列或交给运营复用");
  }

  const accountButton = (
    <button className={isLoggedIn ? "accountButton loggedIn" : "accountButton"} type="button" onClick={openUserPanel}>
      我的
    </button>
  );

  const userPanel = userPanelOpen ? (
    <div className="userPanelBackdrop" role="presentation" onClick={() => setUserPanelOpen(false)}>
      <section className="userPanel" aria-label="用户中心" role="dialog" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>我的工作台</span>
            <strong>通用百货AI创作平台账号</strong>
          </div>
          <button aria-label="关闭用户中心" type="button" onClick={() => setUserPanelOpen(false)}>×</button>
        </header>
        <div className="userProfileCard">
          <i>AI</i>
          <span>
            <strong>{currentUser?.phone ?? "未登录用户"}</strong>
            <em>{isLoggedIn ? `当前使用者：${currentActor?.actorName ?? "默认同事"}` : "请使用手机号、密码和使用者名称登录或注册"}</em>
          </span>
        </div>
        {!isLoggedIn ? (
          <div className="authPanel">
            <div className="authModeSwitch">
              <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>登录</button>
              <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>注册</button>
            </div>
            <input inputMode="tel" placeholder="手机号" value={authPhone} onChange={(event) => setAuthPhone(event.target.value.replace(/\D/g, "").slice(0, 11))} />
            <input placeholder="密码，至少 8 位" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
            {authMode === "login" ? <Link className="forgotPasswordLink" href="/reset-password" onClick={() => setUserPanelOpen(false)}>忘记密码？</Link> : null}
            <input placeholder="当前使用者，例如：美工A / 运营B" value={authActorName} onChange={(event) => setAuthActorName(event.target.value)} />
            <button type="button" onClick={() => void submitAuth()}>{authMode === "register" ? "注册并登录" : "登录账号"}</button>
            <span>{authStatus}</span>
          </div>
        ) : null}
        <div className="userMetricGrid">
          <div><strong>{userJobs.length}</strong><span>历史任务</span></div>
          <div><strong>{formatCompactNumber(creditAccount?.balanceCredits ?? 0)}</strong><span>可用积分</span></div>
          <div><strong>{formatCompactNumber(creditAccount?.frozenCredits ?? 0)}</strong><span>冻结积分</span></div>
        </div>
        <div className="userPanelSections">
          <Link className="userPanelAction" href="/recharge" onClick={() => setUserPanelOpen(false)}>
            <strong>算力点充值</strong>
            <span>查看套餐、创建充值订单与管理余额</span>
          </Link>
          <Link className="userPanelAction" href="/generation-records?tab=images" onClick={() => setUserPanelOpen(false)}>
            <strong>生成记录</strong>
            <span>{userJobs.length ? `${userJobs.length} 个任务` : userJobsStatus}</span>
          </Link>
          <Link className="userPanelAction" href="/account" onClick={() => setUserPanelOpen(false)}>
            <strong>账号资料</strong>
            <span>{currentUser ? `${currentUser.status === "active" ? "启用" : "停用"} · ${currentUser.id}` : "注册后自动创建积分账户"}</span>
          </Link>
          <Link className="userPanelAction feedbackAction" href="/feedback" onClick={() => setUserPanelOpen(false)}>
            <strong>网站报错和建议</strong>
            <span>提交问题描述、报错截图或改进建议</span>
          </Link>
          {isLoggedIn ? (
            <button className="userPanelAction logoutAction" type="button" onClick={() => void logout()}>
              <strong>退出登录 / 切换账号</strong>
              <span>清空当前工作台账号状态，返回登录入口</span>
            </button>
          ) : null}
        </div>
      </section>
    </div>
  ) : null;

  if (view === "home") {
    return (
      <main className="homePortal">
        <header className="portalHeader">
          <BrandMark onHome={() => setView("home")} />
          {accountButton}
        </header>
        {userPanel}

        <section className="homeHero">
          <div className="homeHeroContent">
            <span>GENERAL MERCHANDISE AI STUDIO</span>
            <h1>
              <span>通用百货类商品</span>
              <span>AI图像智能创作平台</span>
            </h1>
            <p>为家居日用、厨房用品、小家电、收纳清洁、个护礼品等商品快速制作高质感图片与短视频素材，让上架、投放和内容更新更轻松。</p>
            <button className="heroCta" type="button" onClick={() => setView("choice")}>
              <span>进入创作平台</span>
              <i aria-hidden="true">→</i>
            </button>
          </div>

          <div className="heroVisual" aria-hidden="true">
            <OptimizedImage asset={optimizedAssets.hero} className="heroPosterImage" fetchPriority="high" />
          </div>
        </section>
      </main>
    );
  }

  if (view === "choice") {
    return (
      <main className="homePortal choicePortal">
        <header className="portalHeader">
          <BrandMark onHome={() => setView("home")} />
          <button type="button" onClick={() => setView("home")}>返回首页</button>
          {accountButton}
        </header>
        {userPanel}

        <section className="choiceShell">
          <div className="choiceIntro">
            <span>选择创作类型</span>
            <h1>今天要创作哪一种内容？</h1>
          </div>

          <div className="choiceGrid">
            <button className="choiceCard imageChoice" type="button" onClick={() => setView("image")}>
              <div className="choicePreview">
                <OptimizedImage asset={optimizedAssets.choiceImage} loading="lazy" />
              </div>
              <span>生图创作</span>
              <strong>生成百货电商图片</strong>
              <em>主图、场景图、白底图、商品详情套图</em>
            </button>

            <button className="choiceCard videoChoice" type="button" onClick={enterVideoChoice}>
              <div className="choicePreview videoPreview">
                <OptimizedImage asset={optimizedAssets.choiceVideo} loading="lazy" />
              </div>
              <span>生视频创作</span>
              <strong>生成百货电商视频</strong>
              <em>参考视频生成，或一句话生成你想要的视频</em>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <form className={view === "video" ? "station videoStation" : "station"} onSubmit={(event) => event.preventDefault()}>
      <header className="stationHeader">
        <button className="logoMark" type="button" onClick={() => setView("home")} aria-label="返回首页">
          <img alt="" src="/brand-logo.svg" />
        </button>
        <h1>
          通用百货AI创作平台
        </h1>
        <div className="headerSlogan" aria-label="网站广告语">
          {view === "video" ? (
            <strong>一个视频或一句话，生成你想要的视频！</strong>
          ) : (
            <>
              <span>无需提示词</span>
              <strong>一键生成专业百货电商图片</strong>
            </>
          )}
        </div>
        <nav>
          <button className={view === "image" ? "active" : ""} type="button" onClick={() => setView("image")}>图像生成</button>
          <button className={view === "video" ? "active" : ""} type="button" onClick={enterVideoChoice}>视频生成</button>
        </nav>
        {accountButton}
      </header>
      {userPanel}

      {view === "image" ? (
        <ImageWorkbench
          files={imageFiles}
          dragTarget={dragTarget}
          setDragTarget={setDragTarget}
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
          category={category}
          setCategory={setCategory}
          activeTask={activeTask}
          setActiveTask={setActiveTask}
          style={style}
          setStyle={setStyle}
          strength={strength}
          setStrength={setStrength}
          suite={suite}
          setSuite={setSuite}
          merchantNote={merchantNote}
          setMerchantNote={setMerchantNote}
          prompt={imagePrompt}
          selectedSuiteLabel={selectedSuite.label}
          selectedSuiteTaskCount={selectedSuite.tasks.length}
          copyStatus={copyStatus}
          copyPrompt={() => copyText(imagePrompt.body, setCopyStatus)}
          createImageJob={createImageJob}
        />
      ) : (
        <VideoWorkbench
          files={videoFiles}
          dragTarget={dragTarget}
          setDragTarget={setDragTarget}
          handleDrop={handleDrop}
          handleFileInput={handleFileInput}
          category={category}
          setCategory={setCategory}
          style={style}
          setStyle={setStyle}
          videoGoal={videoGoal}
          setVideoGoal={setVideoGoal}
          videoPlatform={videoPlatform}
          setVideoPlatform={setVideoPlatform}
          videoRhythm={videoRhythm}
          setVideoRhythm={setVideoRhythm}
          videoCreationMode={videoCreationMode}
          setVideoCreationMode={setVideoCreationMode}
          videoNote={videoNote}
          setVideoNote={setVideoNote}
          prompt={videoPrompt}
          copyStatus={videoCopyStatus}
          copyPrompt={() => copyText(videoPrompt.body, setVideoCopyStatus)}
        />
      )}
    </form>
  );
}

function BrandMark({ onHome }: { onHome: () => void }) {
  return (
    <button className="brandMark" type="button" onClick={onHome}>
      <img alt="" src="/brand-logo.svg" />
      <span>
        <strong>通用百货AI创作平台</strong>
        <em>Common Merchandise Station</em>
      </span>
    </button>
  );
}

function OptimizedImage(input: {
  asset: OptimizedAsset;
  className?: string;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
}) {
  return (
    <picture>
      <source srcSet={input.asset.avif} sizes={input.asset.sizes} type="image/avif" />
      <source srcSet={input.asset.webp} sizes={input.asset.sizes} type="image/webp" />
      <img
        alt=""
        className={input.className}
        decoding="async"
        fetchPriority={input.fetchPriority}
        loading={input.loading ?? "eager"}
        sizes={input.asset.sizes}
        src={input.asset.fallback}
      />
    </picture>
  );
}

function UploadPanel(input: {
  mode: "image" | "video";
  files: UploadedFile[];
  dragTarget: "image" | "video" | undefined;
  setDragTarget: (target: "image" | "video" | undefined) => void;
  handleDrop: (event: DragEvent<HTMLLabelElement>, target: "image" | "video") => void;
  handleFileInput: (event: ChangeEvent<HTMLInputElement>, target: "image" | "video") => void;
  title?: string;
  desc?: string;
  dropLabel?: string;
  dropNote?: string;
  accept?: string;
  onFiles?: (files: FileList | File[]) => void;
}) {
  return (
    <section className="uploadSurface compact">
      <header className="uploadSurfaceHeader">
        <div>
          <span>商品素材</span>
          <strong>{input.title ?? (input.mode === "image" ? "上传商品图" : "上传商品素材")}</strong>
        </div>
        <em>{input.files.length ? `${input.files.length} 个素材` : "未上传"}</em>
      </header>
      <label
        className={`uploadDropZone ${input.dragTarget === input.mode ? "active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          input.setDragTarget(input.mode);
        }}
        onDragLeave={() => input.setDragTarget(undefined)}
        onDrop={(event) => {
          if (input.onFiles) {
            event.preventDefault();
            input.setDragTarget(undefined);
            input.onFiles(event.dataTransfer.files);
            return;
          }
          input.handleDrop(event, input.mode);
        }}
      >
        <input
          type="file"
          accept={input.accept ?? (input.mode === "image" ? "image/*" : "image/*,video/*")}
          multiple
          onChange={(event) => {
            if (input.onFiles && event.target.files) input.onFiles(event.target.files);
            else input.handleFileInput(event, input.mode);
            event.target.value = "";
          }}
        />
        <i>+</i>
        <strong>{input.dropLabel ?? (input.mode === "image" ? "拖入商品图或点击上传" : "拖入商品图/视频或点击上传")}</strong>
        <small>{input.dropNote ?? input.desc ?? (input.mode === "image" ? "白底、实拍、包装、透明底都可以，用于锁定商品外形、颜色、材质和包装。" : "可放商品图、手持视频、开箱参考或平台样片。")}</small>
      </label>
      <div className="assetMiniBoard">
        <span>已上传素材</span>
        <div className="fileList">
        {input.files.length ? input.files.map((file) => (
          <article key={file.id}>
            <img alt={file.name} src={file.previewUrl} />
            <div>
              <strong>{file.name}</strong>
              <small>{formatFileSize(file.size)}</small>
            </div>
          </article>
        )) : <p>暂无素材。上传后会显示在这里。</p>}
        </div>
      </div>
    </section>
  );
}

function StepTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="stepTitle">
      <span>{index}</span>
      <strong>{title}</strong>
    </div>
  );
}

function SpecButton(input: {
  active: boolean;
  spec: { label: string; assetGroup: string; targetWidth: number; targetHeight: number };
  onClick: () => void;
}) {
  return (
    <button className={input.active ? "specButton specCard active" : "specButton specCard"} type="button" onClick={input.onClick}>
      <strong>{input.spec.label}</strong>
      <span>{input.spec.assetGroup} · {input.spec.targetWidth}x{input.spec.targetHeight}</span>
    </button>
  );
}

function StyleCover(input: { id: string; label: string }) {
  const labelClass = input.label.length > 4 ? "compact" : "";

  return (
    <span className={`styleSwatch styleSwatch--${input.id}`}>
      <strong className={labelClass}>{input.label}</strong>
    </span>
  );
}

function TaskSummaryItem(input: { index: string; label: string; value: string }) {
  return (
    <div className="summaryItem">
      <i>{input.index}</i>
      <div className="summaryItemBody">
        <span>{input.label}</span>
        <strong>{input.value}</strong>
      </div>
    </div>
  );
}

function ImageWorkbench(input: {
  files: UploadedFile[];
  dragTarget: "image" | "video" | undefined;
  setDragTarget: (target: "image" | "video" | undefined) => void;
  handleDrop: (event: DragEvent<HTMLLabelElement>, target: "image" | "video") => void;
  handleFileInput: (event: ChangeEvent<HTMLInputElement>, target: "image" | "video") => void;
  category: CategoryId;
  setCategory: (id: CategoryId) => void;
  activeTask: TaskId;
  setActiveTask: (id: TaskId) => void;
  style: StyleId;
  setStyle: (id: StyleId) => void;
  strength: StrengthId;
  setStrength: (id: StrengthId) => void;
  suite: SuiteId;
  setSuite: (id: SuiteId) => void;
  merchantNote: string;
  setMerchantNote: (value: string) => void;
  prompt: { summary: string; body: string };
  selectedSuiteLabel: string;
  selectedSuiteTaskCount: number;
  copyStatus: string;
  copyPrompt: () => void;
  createImageJob: () => void;
}) {
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryGroupId, setCategoryGroupId] = useState(commonCategoryGroups[0].id);
  const [platform, setPlatform] = useState<CommercePlatformId>("taobao");
  const [crossBorderPlatformsExpanded, setCrossBorderPlatformsExpanded] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<ImageSpecId>("square_main");
  const [customWidth, setCustomWidth] = useState("800");
  const [customHeight, setCustomHeight] = useState("800");
  const [displayProfileId, setDisplayProfileId] = useState(displayProfiles[0].id);
  const [styleReferenceName, setStyleReferenceName] = useState("");
  const [customStyleNames, setCustomStyleNames] = useState<string[]>([]);
  const [imageTypeCounts, setImageTypeCounts] = useState<Record<ImageTypeId, number>>(defaultImageTypeCounts);
  const [simulatePhotoMetadata, setSimulatePhotoMetadata] = useState(true);
  const currentCategory = categories.find((item) => item.id === input.category) ?? categories[0];
  const currentTask = tasks.find((item) => item.id === input.activeTask) ?? tasks[0];
  const currentStyle = styles.find((item) => item.id === input.style) ?? styles[0];
  const currentStrength = strengths.find((item) => item.id === input.strength) ?? strengths[0];
  const taskMode = input.suite === "detail" ? "detail_suite" : "single";
  const selectedCategoryGroup = commonCategoryGroups.find((item) => item.id === categoryGroupId) ?? commonCategoryGroups[0];
  const productCategoryPresets = selectedCategoryGroup.categories.map((id) => categories.find((item) => item.id === id)).filter(Boolean) as typeof categories;
  const categorySearchResults = categories.filter((item) => {
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) return false;
    return `${item.label} ${item.desc}`.toLowerCase().includes(query);
  });
  const availableSpecs = commonSpecs.filter((item) => platform === "free" || item.platforms.includes(platform));
  const selectedSpec = selectedSpecId === "custom" ? undefined : commonSpecs.find((item) => item.id === selectedSpecId);
  const selectedImageType = commonImageTypes.find((item) => item.taskId === input.activeTask) ?? commonImageTypes[0];
  const selectedClassicStyleCount = styles.filter((item) => item.id === input.style).length;

  function selectCategory(id: CategoryId) {
    input.setCategory(id);
    const nextGroup = commonCategoryGroups.find((group) => group.categories.includes(id));
    if (nextGroup) setCategoryGroupId(nextGroup.id);
    setCategorySearchQuery("");
  }

  function switchPlatform(nextPlatform: CommercePlatformId) {
    setPlatform(nextPlatform);
    const nextSpec = commonSpecs.find((item) => nextPlatform === "free" || item.platforms.includes(nextPlatform));
    if (nextSpec) setSelectedSpecId(nextSpec.id);
  }

  function selectDisplayProfile(profile: (typeof displayProfiles)[number]) {
    setDisplayProfileId(profile.id);
    input.setActiveTask(profile.taskId);
  }

  function selectImageType(item: (typeof commonImageTypes)[number]) {
    input.setActiveTask(item.taskId);
    setImageTypeCounts((current) => ({
      ...current,
      [item.id]: Math.max(current[item.id] ?? 0, 1)
    }));
  }

  function changeImageTypeCount(item: (typeof commonImageTypes)[number], delta: number) {
    input.setActiveTask(item.taskId);
    setImageTypeCounts((current) => {
      const nextCount = Math.min(9, Math.max(0, (current[item.id] ?? 0) + delta));
      return { ...current, [item.id]: nextCount };
    });
  }

  function saveCustomStyle() {
    const nextName = styleReferenceName.trim();
    if (!nextName) return;
    setCustomStyleNames((current) => current.includes(nextName) ? current : [nextName, ...current].slice(0, 6));
  }

  return (
    <>
      <aside className="controlRail">
        <section className="taskModePanel" aria-label="图像任务模式">
          <button
            className={taskMode === "single" ? "taskModeCard active" : "taskModeCard"}
            type="button"
            onClick={() => input.setSuite("listing")}
          >
            <strong>主图[单张/批量]</strong>
            <span>平台主图、白底图、风格图等单项生成</span>
          </button>
          <button
            className={taskMode === "detail_suite" ? "taskModeCard active" : "taskModeCard"}
            type="button"
            onClick={() => input.setSuite("detail")}
          >
            <strong>宝贝详情[套图]</strong>
            <span>多商品一口气生成详情页结构</span>
          </button>
        </section>

        <section>
          <div className="categoryTitleRow">
            <StepTitle index="01" title="百货细分" />
            <div className="categorySearchBox">
              <input
                aria-label="搜索具体类目"
                placeholder="搜索百货细分"
                type="search"
                value={categorySearchQuery}
                onChange={(event) => setCategorySearchQuery(event.target.value)}
              />
              {categorySearchQuery.trim() ? (
                <div className="categorySearchPanel" role="listbox" aria-label="类目搜索结果">
                  {categorySearchResults.length ? (
                    categorySearchResults.map((item) => (
                      <button key={item.id} type="button" onClick={() => selectCategory(item.id)}>
                        <strong>{item.label}</strong>
                        <span>{item.desc}</span>
                      </button>
                    ))
                  ) : (
                    <button type="button" onClick={() => selectCategory("general")}>
                      <strong>其他</strong>
                      <span>未录入细分类目可先按百货通用商品生成</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="compactCategoryHeader">
            <strong>{selectedCategoryGroup.label}</strong>
            <span>当前：{selectedCategoryGroup.label} · {currentCategory.label}</span>
          </div>
          <div className="categoryGroupStrip" aria-label="百货二级类目">
            {commonCategoryGroups.map((item) => (
              <button
                className={categoryGroupId === item.id ? "categoryGroupChip active" : "categoryGroupChip"}
                key={item.id}
                type="button"
                onClick={() => {
                  setCategoryGroupId(item.id);
                  selectCategory(item.categories[0]);
                }}
              >
                <i>{item.mark}</i>
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.desc}</em>
                </span>
              </button>
            ))}
          </div>
          <div className="compactCategoryStrip" aria-label={`${selectedCategoryGroup.label}商品类目`}>
            {productCategoryPresets.map((item) => (
              <button
                className={input.category === item.id ? "compactCategoryChip active" : "compactCategoryChip"}
                key={item.id}
                type="button"
                onClick={() => selectCategory(item.id)}
              >
                <i>{item.label.slice(0, 1)}</i>
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.desc}</em>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index="02" title={taskMode === "detail_suite" ? "详情图规格" : "平台规格与图片类型"} />
          {taskMode !== "detail_suite" ? (
            <div className="platformList">
              {domesticPlatforms.map((item) => (
                <button className={platform === item ? "platformButton active" : "platformButton"} key={item} type="button" onClick={() => switchPlatform(item)}>
                  {platformLabels[item]}
                </button>
              ))}
              <button className={platform === "free" ? "platformButton active" : "platformButton"} type="button" onClick={() => switchPlatform("free")}>
                {platformLabels.free}
              </button>
              <button
                aria-expanded={crossBorderPlatformsExpanded}
                className={crossBorderPlatforms.includes(platform) ? "platformButton platformGroupButton active" : "platformButton platformGroupButton"}
                type="button"
                onClick={() => setCrossBorderPlatformsExpanded((value) => !value)}
              >
                跨境平台
              </button>
            </div>
          ) : null}
          {taskMode !== "detail_suite" && crossBorderPlatformsExpanded ? (
            <div className="crossBorderPlatformPanel" aria-label="跨境平台子品类">
              {crossBorderPlatforms.map((item) => (
                <button className={platform === item ? "active" : ""} key={item} type="button" onClick={() => switchPlatform(item)}>
                  {platformLabels[item]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="specList compactSpecList">
            <div className="specGroup">
              <strong>{taskMode === "detail_suite" ? "详情规格" : "主图规格"}</strong>
              <div className="specGroupGrid">
                {taskMode === "detail_suite" ? (
                  <button className={selectedSpecId === "detail_long" ? "specButton specCard active" : "specButton specCard"} type="button" onClick={() => setSelectedSpecId("detail_long")}>
                    <strong>默认规格790宽</strong>
                    <span>详情模块 · 790x1200</span>
                  </button>
                ) : (
                  availableSpecs.filter((item) => item.id !== "detail_long").map((item) => (
                    <SpecButton active={selectedSpecId === item.id} key={item.id} spec={item} onClick={() => setSelectedSpecId(item.id)} />
                  ))
                )}
                <button className={selectedSpecId === "custom" ? "specButton active" : "specButton"} type="button" onClick={() => setSelectedSpecId("custom")}>
                  <span className="specCard">
                    <strong>{taskMode === "detail_suite" ? "自定义详情图尺寸" : "自定义尺寸"}</strong>
                    <span>{customWidth}x{customHeight}</span>
                  </span>
                </button>
              </div>
              {selectedSpecId === "custom" ? (
                <div className="customSpecInputs">
                  <label>
                    宽
                    <input inputMode="numeric" value={customWidth} onChange={(event) => setCustomWidth(event.target.value.replace(/\D/g, "").slice(0, 4))} />
                  </label>
                  <label>
                    高
                    <input inputMode="numeric" value={customHeight} onChange={(event) => setCustomHeight(event.target.value.replace(/\D/g, "").slice(0, 4))} />
                  </label>
                </div>
              ) : null}
              <div className="imageTypeList">
                <div className="imageTypeHeader">
                  <strong>{taskMode === "detail_suite" ? "详情生成类型" : "主图生成类型"}</strong>
                  <span>已选：{selectedImageType.label}</span>
                </div>
                {commonImageTypes.map((item) => (
                  <div className={selectedImageType.id === item.id ? "imageTypeOption active" : "imageTypeOption"} key={item.id}>
                    <button className="imageTypeSelectButton" type="button" onClick={() => selectImageType(item)}>
                      <strong>{item.label}</strong>
                      <em>{item.desc}</em>
                    </button>
                    <div className="imageTypeCountStepper" aria-label={`${item.label}生成数量`}>
                      <button type="button" disabled={(imageTypeCounts[item.id] ?? 0) <= 0} onClick={() => changeImageTypeCount(item, -1)}>−</button>
                      <input readOnly value={imageTypeCounts[item.id] ?? 0} />
                      <button type="button" disabled={(imageTypeCounts[item.id] ?? 0) >= 9} onClick={() => changeImageTypeCount(item, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <StepTitle index="03" title="商品展示方式" />
          <div className="modeSwitch" role="group" aria-label="商品展示方式">
            {displayProfiles.map((item) => (
              <button className={displayProfileId === item.id ? "active" : ""} key={item.id} type="button" onClick={() => selectDisplayProfile(item)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="modelPanel commonDisplayPanel">
            {displayProfiles.map((item) => (
              <button className={displayProfileId === item.id ? "modelOption active" : "modelOption"} key={item.id} type="button" onClick={() => selectDisplayProfile(item)}>
                <i className="modelThumb">{item.label.slice(0, 1)}</i>
                <span>
                  <strong>{item.label}</strong>
                  <em>{item.desc}</em>
                </span>
              </button>
            ))}
          </div>
          <div className="platformProtocol">
            <strong>{displayProfiles.find((item) => item.id === displayProfileId)?.label}</strong>
            <span>百货不固定鞋类上脚模特库，只按商品真实需求选择人物参与程度。</span>
          </div>
        </section>

        <section>
          <StepTitle index="04" title="图片风格" />
          <div className="styleReferenceUpload">
            <div className="customStyleHeader">
              <strong>爆款风格复刻</strong>
              <span>{styleReferenceName ? "已上传参考风格图，本次按参考质感生成。" : "上传参考图会优先复刻构图、光影和质感。"}</span>
            </div>
            <input
              accept="image/png,image/jpeg,image/webp"
              id="common-style-reference"
              onChange={(event) => setStyleReferenceName(event.target.files?.[0]?.name ?? "")}
              type="file"
            />
            <div className={styleReferenceName ? "styleReferenceRow hasImage" : "styleReferenceRow"}>
              <button className="styleReferencePickButton" type="button" onClick={() => document.getElementById("common-style-reference")?.click()}>
                <span>
                  <i className="styleReferencePlus" aria-hidden="true">+</i>
                  <strong>上传参考风格图</strong>
                  <em className="styleReferenceFilename">{styleReferenceName || "点击上传图片作为风格参考"}</em>
                </span>
              </button>
              {styleReferenceName ? (
                <button aria-label={`删除${styleReferenceName}`} className="styleReferenceRemoveButton" type="button" onClick={() => setStyleReferenceName("")}>
                  −
                </button>
              ) : null}
            </div>
            <button className="saveCustomStyleButton" disabled={!styleReferenceName} type="button" onClick={saveCustomStyle}>
              保存为自定义风格
            </button>
            <div className="customStyleLibrary">
              <div className="customStyleHeader">
                <strong>自定义风格库</strong>
                <span>{customStyleNames.length ? "已保存的风格可再次选用" : "保存参考图风格后会显示在这里"}</span>
              </div>
              {customStyleNames.length ? (
                <div className="customStyleSavedList">
                  {customStyleNames.map((item) => (
                    <button key={item} type="button" onClick={() => setStyleReferenceName(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="compactMenuHeader">
            <div>
              <strong>经典电商风格</strong>
              <span>百货通用 · 经典 {selectedClassicStyleCount}/{styles.length} 种 · {currentStyle.label}</span>
            </div>
          </div>
          <div className="styleList compactStyleList">
            {styles.map((item) => (
              <button className={input.style === item.id ? "styleOption active" : "styleOption"} key={item.id} type="button" onClick={() => input.setStyle(item.id)}>
                <StyleCover label={item.label} id={item.id} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index="05" title="图片参数（核心技术）" />
          <label className="photoMetadataToggle">
            <input checked={simulatePhotoMetadata} onChange={(event) => setSimulatePhotoMetadata(event.target.checked)} type="checkbox" />
            <span>
              <em>勾选此项，易避开平台AI排查,更易获取流量。</em>
            </span>
          </label>
          <div className="strengthGrid compactStrengthGrid">
            {strengths.map((item) => (
              <button className={input.strength === item.id ? "active" : ""} key={item.id} type="button" onClick={() => input.setStrength(item.id)}>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index="06" title="提示词补充" />
          <div className="promptAssistBox">
            <div>
              <strong>可不填</strong>
              <span>默认按前面选项自动生成。需要特殊要求时，再补充一句。</span>
            </div>
            <textarea
              aria-label="提示词补充"
              maxLength={500}
              placeholder="例如：重点展示容量大、可折叠、礼盒装、适合厨房台面，背景干净高级。"
              rows={4}
              value={input.merchantNote}
              onChange={(event) => input.setMerchantNote(event.target.value)}
            />
            <em>{input.merchantNote.length}/500</em>
          </div>
        </section>
      </aside>

      <main className="mainStage">
        <section className="taskSummary">
          <div className="summaryHeader">
            <span>当前任务</span>
            <strong>确认左侧选项后上传商品素材</strong>
          </div>
          <div className="summaryGrid">
            <TaskSummaryItem index="01" label="平台" value={platformLabels[platform]} />
            <TaskSummaryItem index="02" label="类目" value={currentCategory.label} />
            <TaskSummaryItem index="03" label="规格" value={selectedSpecId === "custom" ? `${customWidth}x${customHeight}` : `${selectedSpec?.targetWidth ?? 800}x${selectedSpec?.targetHeight ?? 800}`} />
            <TaskSummaryItem index="04" label="图片类型" value={currentTask.label} />
          </div>
        </section>
        <UploadPanel mode="image" files={input.files} dragTarget={input.dragTarget} setDragTarget={input.setDragTarget} handleDrop={input.handleDrop} handleFileInput={input.handleFileInput} />
        <label className="noteField mainNoteField">
          <span>商品补充说明</span>
          <textarea value={input.merchantNote} onChange={(event) => input.setMerchantNote(event.target.value)} placeholder="例如：重点展示防滑底、容量大、可折叠、礼盒装、适合厨房台面..." />
        </label>
        <div className="actionRow">
          <div className="actionButtons">
            <button className="generateButton" type="button" onClick={input.createImageJob}>生成图片</button>
            <button className="secondaryActionButton" type="button" onClick={input.copyPrompt}>复制提示词</button>
          </div>
          <span>{input.copyStatus}</span>
        </div>
      </main>

      <ResultRail
        title="图片生成结果"
        modeLabel="等待生图任务"
        summary={input.prompt.summary}
        subline={`当前套餐：${input.selectedSuiteLabel}，包含 ${input.selectedSuiteTaskCount} 个生成任务`}
        body={input.prompt.body}
        emptyText="真实生图接口接入后，右侧会展示生成结果、进度和下载入口。"
        copyPrompt={input.copyPrompt}
      />
    </>
  );
}

function VideoWorkbench(input: {
  files: UploadedFile[];
  dragTarget: "image" | "video" | undefined;
  setDragTarget: (target: "image" | "video" | undefined) => void;
  handleDrop: (event: DragEvent<HTMLLabelElement>, target: "image" | "video") => void;
  handleFileInput: (event: ChangeEvent<HTMLInputElement>, target: "image" | "video") => void;
  category: CategoryId;
  setCategory: (id: CategoryId) => void;
  style: StyleId;
  setStyle: (id: StyleId) => void;
  videoGoal: VideoGoalId;
  setVideoGoal: (id: VideoGoalId) => void;
  videoPlatform: VideoPlatformId;
  setVideoPlatform: (id: VideoPlatformId) => void;
  videoRhythm: VideoRhythmId;
  setVideoRhythm: (id: VideoRhythmId) => void;
  videoCreationMode: VideoCreationMode;
  setVideoCreationMode: (mode: VideoCreationMode) => void;
  videoNote: string;
  setVideoNote: (value: string) => void;
  prompt: { summary: string; body: string };
  copyStatus: string;
  copyPrompt: () => void;
}) {
  const [videoSpec, setVideoSpec] = useState<(typeof videoSpecOptions)[number]["id"]>("vertical");
  const [referenceMode, setReferenceMode] = useState<(typeof referenceModeOptions)[number]["id"]>("medium");
  const [selectedGoals, setSelectedGoals] = useState<string[]>(["换成我的商品", "保留节奏，重写文案"]);
  const [musicMode, setMusicMode] = useState(musicModeOptions[0]);
  const [voiceoverMode, setVoiceoverMode] = useState(voiceoverModeOptions[0]);
  const [subtitleMode, setSubtitleMode] = useState(subtitleModeOptions[1]);
  const [videoQuality, setVideoQuality] = useState<(typeof directVideoQualities)[number]["id"]>("480p");
  const [videoDuration, setVideoDuration] = useState<(typeof videoDurationOptions)[number]["id"]>("5");
  const [customDuration, setCustomDuration] = useState("5");
  const [referenceLink, setReferenceLink] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<UploadedFile[]>([]);
  const [generatedVideoPrompt, setGeneratedVideoPrompt] = useState("");
  const [promptRevision, setPromptRevision] = useState("");
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const currentSpec = videoSpecOptions.find((item) => item.id === videoSpec) ?? videoSpecOptions[0];
  const currentDuration = videoDuration === "custom" ? `${customDuration || 5}秒` : `${videoDuration}秒`;
  const captionMode = `${musicMode} · ${voiceoverMode} · ${subtitleMode}`;

  function toggleGoal(goal: string) {
    setSelectedGoals((current) => current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]);
  }

  function showGeneratedPrompt() {
    setGeneratedVideoPrompt(input.prompt.body);
    setPromptRevision("");
    setPromptDialogOpen(true);
  }

  function addReferenceFiles(files: FileList | File[]) {
    const uploads = Array.from(files).filter((file) => file.type.startsWith("video/")).map(fileToUpload);
    setReferenceFiles((current) => [...uploads, ...current].slice(0, 5));
  }

  function submitPromptRevision() {
    const revision = promptRevision.trim();
    if (!revision) return;
    setGeneratedVideoPrompt((current) => [
      current || input.prompt.body,
      "",
      "补充意见已合并：",
      revision,
      "",
      "Revision instruction: apply the added requirement above while preserving the uploaded product's true shape, color, material, packaging, visible details and functional facts."
    ].join("\n"));
    setPromptRevision("");
  }

  if (input.videoCreationMode === "choose") {
    return (
      <main className="mainStage videoStage videoChoiceStage videoChoiceStageFull">
        <div className="videoChoiceHeader">
          <strong>选择视频生成方式，开始你的创作</strong>
          <p>两种生成方式，满足不同百货商品创作需求</p>
        </div>
        <div className="videoModeCards">
          <article className="videoModeCard" role="button" tabIndex={0} onClick={() => input.setVideoCreationMode("reference")} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") input.setVideoCreationMode("reference");
          }}>
            <div className="videoModeText">
              <span>上传参考视频，生成目标视频</span>
              <strong>上传开箱、手持、家居摆拍或商品展示视频，保留运镜节奏，替换为当前百货商品表达。</strong>
            </div>
            <div className="referenceFlowPreview choiceReferenceVisual" aria-hidden="true">
              <OptimizedImage asset={optimizedAssets.videoReference} loading="lazy" />
            </div>
            <div className="videoModeFooter">
              <p>适合：已有商品展示视频，希望保留节奏并重塑商品画面</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); input.setVideoCreationMode("reference"); }}>进入此模式 →</button>
            </div>
          </article>
          <article className="videoModeCard" role="button" tabIndex={0} onClick={() => input.setVideoCreationMode("prompt")} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") input.setVideoCreationMode("prompt");
          }}>
            <div className="videoModeText">
              <span>一句话，生成你想要的视频</span>
              <strong>输入卖点脚本，自动组织商品亮相、功能演示、细节特写和购买氛围。</strong>
            </div>
            <div className="customFlowPreview choicePromptVisual" aria-hidden="true">
              <OptimizedImage asset={optimizedAssets.videoPrompt} loading="lazy" />
            </div>
            <p className="choiceModeHint">从一句需求到完整镜头组</p>
            <div className="videoModeFooter">
              <p>适合：没有参考视频，需要按百货卖点自动生成镜头</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); input.setVideoCreationMode("prompt"); }}>进入此模式 →</button>
            </div>
          </article>
        </div>
      </main>
    );
  }

  const currentCategory = categories.find((item) => item.id === input.category) ?? categories[0];
  const currentStyle = styles.find((item) => item.id === input.style) ?? styles[0];
  const currentGoal = videoGoals.find((item) => item.id === input.videoGoal) ?? videoGoals[0];
  const currentPlatform = videoPlatforms.find((item) => item.id === input.videoPlatform) ?? videoPlatforms[0];
  const currentRhythm = videoRhythms.find((item) => item.id === input.videoRhythm) ?? videoRhythms[0];

  return (
    <>
      <aside className="controlRail videoControlRail">
        <section>
          <StepTitle index="01" title="视频规格" />
          <div className="videoPlatformGrid">
            {videoSpecOptions.map((item) => (
              <button className={videoSpec === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setVideoSpec(item.id)}>
                <strong>{item.label}</strong>
                <span>{item.spec}</span>
              </button>
            ))}
          </div>
        </section>

        {input.videoCreationMode === "reference" ? (
          <section>
            <StepTitle index="02" title="参考方式" />
            <div className="rewriteModeList">
              {referenceModeOptions.map((item) => (
                <button className={referenceMode === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setReferenceMode(item.id)}>
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "03" : "02"} title="想改什么" />
          <div className="videoGoalGrid">
            {commonVideoGoals.map((item) => (
              <button className={selectedGoals.includes(item) ? "active" : ""} key={item} type="button" onClick={() => toggleGoal(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "04" : "03"} title="声音" />
          <div className="videoOptionStack">
            <span>背景音乐</span>
            <div className="videoOptionGrid">
              {musicModeOptions.map((item) => (
                <button className={musicMode === item ? "active" : ""} key={item} type="button" onClick={() => setMusicMode(item)}>
                  {item}
                </button>
              ))}
            </div>
            <span>配音</span>
            <div className="videoOptionGrid">
              {voiceoverModeOptions.map((item) => (
                <button className={voiceoverMode === item ? "active" : ""} key={item} type="button" onClick={() => setVoiceoverMode(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "05" : "04"} title="字幕" />
          <div className="videoOptionStack">
            <div className="videoOptionGrid">
              {subtitleModeOptions.map((item) => (
                <button className={subtitleMode === item ? "active" : ""} key={item} type="button" onClick={() => setSubtitleMode(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "06" : "05"} title="视频输出" />
          <div className="videoOutputQuality">
            <span>视频输出质量</span>
            <div className="videoQualityGrid">
              {directVideoQualities.map((item) => (
                <button className={videoQuality === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setVideoQuality(item.id)}>
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </button>
              ))}
            </div>
            <span>视频时长</span>
            <div className="videoQualityGrid videoDurationGrid">
              {videoDurationOptions.map((item) => (
                <button className={videoDuration === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setVideoDuration(item.id)}>
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </button>
              ))}
            </div>
            {videoDuration === "custom" ? (
              <label className="videoDurationCustomInput">
                自定义秒数
                <input inputMode="numeric" max={15} min={1} type="number" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} />
              </label>
            ) : null}
            <em>草稿默认按 480P / 5 秒先生成，确认后再走高清输出。</em>
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "07" : "06"} title="百货类目" />
          <div className="categoryGrid">
            {categories.map((item) => (
              <button className={input.category === item.id ? "active" : ""} key={item.id} type="button" onClick={() => input.setCategory(item.id)}>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "08" : "07"} title="视频类型" />
          <div className="videoTypeList">
            {videoGoals.map((goal) => (
              <button className={input.videoGoal === goal.id ? "active" : ""} key={goal.id} type="button" onClick={() => input.setVideoGoal(goal.id)}>
                <strong>{goal.label}</strong>
                <span>{goal.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "09" : "08"} title="平台与风格" />
          <div className="pillGrid">
            {videoPlatforms.map((item) => (
              <button className={input.videoPlatform === item.id ? "active" : ""} key={item.id} type="button" onClick={() => input.setVideoPlatform(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <OptionRows items={styles} activeId={input.style} onSelect={input.setStyle} />
        </section>

        <section>
          <StepTitle index={input.videoCreationMode === "reference" ? "10" : "09"} title="输出强度" />
          <div className="strengthGrid">
            {videoRhythms.map((item) => (
              <button className={input.videoRhythm === item.id ? "active" : ""} key={item.id} type="button" onClick={() => input.setVideoRhythm(item.id)}>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="mainStage videoStage videoSubStage">
        <div className="videoSubModeHeader">
          <strong>{input.videoCreationMode === "reference" ? "参考视频生视频" : "一句话生成你想要的视频"}</strong>
          <button type="button" onClick={() => input.setVideoCreationMode(input.videoCreationMode === "reference" ? "prompt" : "reference")}>
            {input.videoCreationMode === "reference" ? "切换到一句话生视频" : "切换到参考视频生视频"}
          </button>
        </div>
        <section className="taskSummary">
          <div className="summaryHeader">
            <span>当前视频任务</span>
            <strong>确认左侧选项后上传商品素材</strong>
          </div>
          <div className="summaryGrid">
            <TaskSummaryItem index="01" label="类目" value={currentCategory.label} />
            <TaskSummaryItem index="02" label="视频类型" value={currentGoal.label} />
            <TaskSummaryItem index="03" label="规格" value={currentSpec.spec} />
            <TaskSummaryItem index="04" label="声音字幕" value={captionMode} />
          </div>
        </section>

        <section className={input.videoCreationMode === "reference" ? "videoUploadStack" : "videoUploadStack customVideoBuilder"}>
          <div className="videoUploadBlock">
            <strong>{input.videoCreationMode === "reference" ? "上传商品素材" : "上传商品图"}</strong>
            <UploadPanel
              mode="video"
              files={input.files}
              dragTarget={input.dragTarget}
              setDragTarget={input.setDragTarget}
              handleDrop={input.handleDrop}
              handleFileInput={input.handleFileInput}
              title={input.videoCreationMode === "reference" ? "商品素材" : "商品图素材"}
              desc={input.videoCreationMode === "reference" ? "必填，支持商品图、包装图、细节图或商品短视频；商品素材决定商品本身。" : "必填，用商品图锁定外形、材质、包装和主要卖点。"}
              dropLabel={input.videoCreationMode === "reference" ? "上传百货商品素材" : "点击或拖拽上传商品图"}
              dropNote={input.videoCreationMode === "reference" ? "可上传白底图、实拍图、包装图、细节图或商品短视频。" : "建议上传白底图、实拍图、包装图和细节图。"}
              accept={input.videoCreationMode === "reference" ? "image/*,video/*" : "image/*"}
            />
          </div>
          {input.videoCreationMode === "reference" ? (
            <div className="videoReferenceBlock">
              <strong>参考视频（二选一）</strong>
              <div className="videoReferenceChoiceGrid">
                <UploadPanel
                  mode="video"
                  files={referenceFiles}
                  dragTarget={input.dragTarget}
                  setDragTarget={input.setDragTarget}
                  handleDrop={input.handleDrop}
                  handleFileInput={input.handleFileInput}
                  onFiles={addReferenceFiles}
                  title="上传参考视频"
                  desc="上传你想参考的短视频，系统会按当前参考强度处理。"
                  dropLabel="上传参考视频"
                  dropNote="参考视频只决定结构、运镜和节奏，不改变商品事实。"
                  accept="video/*"
                />
                <label className="videoReferenceLinkBox">
                  <span>粘贴参考视频链接</span>
                  <input onChange={(event) => setReferenceLink(event.target.value)} placeholder="抖音 / 快手 / 小红书 / 视频号" value={referenceLink} />
                  <em>链接会先进入自建解析；未解析出视频文件前不会提交或扣参考费用。</em>
                  {referenceLink.trim() ? <strong>使用链接参考</strong> : null}
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <label className="noteField mainNoteField">
          <span>{input.videoCreationMode === "reference" ? "补充要求（选填）" : "一句话，AI代写生视频提示词"}</span>
          <textarea
            value={input.videoNote}
            onChange={(event) => input.setVideoNote(event.target.value)}
            placeholder={input.videoCreationMode === "reference" ? "例如：参考视频的开箱节奏保留，但商品换成当前百货；不要出现原视频品牌和字幕..." : "简单描述想要什么样的视频，例如：高级棚拍感，厨房台面使用场景，突出容量和材质，适合抖音投放。"}
          />
        </label>
        <div className="videoOriginalityNote">
          {input.videoCreationMode === "reference"
            ? "参考规则：商品素材决定商品本身，参考视频决定展示结构和节奏；不主动新增参考中没有的人物、口播或密集字幕。"
            : "一句话模式会按商品素材和需求自动组织镜头，商品外形、颜色、包装和功能不得被改写。"}
        </div>
        <div className="actionRow">
          <button className="generateButton" type="button" onClick={input.videoCreationMode === "reference" ? input.copyPrompt : showGeneratedPrompt}>
            {input.videoCreationMode === "reference" ? "生成参考视频提示词" : "生成一句话视频提示词"}
          </button>
          <span>{input.videoCreationMode === "reference" ? input.copyStatus : (promptDialogOpen ? "提示词已生成，可继续提交补充意见" : "生成后会在下方对话框中展示提示词")}</span>
        </div>

        {input.videoCreationMode === "prompt" && promptDialogOpen ? (
          <section className="promptDialogPanel" role="dialog" aria-label="生成的视频提示词">
            <header>
              <strong>生成的视频提示词</strong>
              <button type="button" onClick={() => setPromptDialogOpen(false)}>关闭</button>
            </header>
            <textarea
              className="generatedPromptText"
              value={generatedVideoPrompt}
              onChange={(event) => setGeneratedVideoPrompt(event.target.value)}
            />
            <label className="promptRevisionField">
              <span>补充意见</span>
              <textarea
                value={promptRevision}
                onChange={(event) => setPromptRevision(event.target.value)}
                placeholder="例如：开头节奏更慢一点，增加材质细节特写，结尾保留干净商品美镜。"
              />
            </label>
            <div className="promptDialogActions">
              <button type="button" onClick={submitPromptRevision}>提交修改提示词</button>
              <button type="button" onClick={() => void navigator.clipboard.writeText(generatedVideoPrompt)}>复制当前提示词</button>
            </div>
          </section>
        ) : null}
      </main>

      <ResultRail
        title="视频生成结果"
        modeLabel={input.videoCreationMode === "reference" ? "参考视频生视频" : "一句话生成你想要的视频"}
        summary={input.prompt.summary}
        subline={`${currentSpec.spec} · ${videoQuality.toUpperCase()} · ${currentDuration}`}
        body={input.prompt.body}
        emptyText="真实生视频接口接入后，右侧会展示视频任务进度、预览和高清输出入口。"
        copyPrompt={input.copyPrompt}
      />
    </>
  );
}

function OptionRows<T extends string>(input: {
  items: Array<{ id: T; label: string; desc: string }>;
  activeId: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="optionRows">
      {input.items.map((item) => (
        <button className={input.activeId === item.id ? "active" : ""} key={item.id} type="button" onClick={() => input.onSelect(item.id)}>
          <span />
          <div>
            <strong>{item.label}</strong>
            <small>{item.desc}</small>
          </div>
        </button>
      ))}
    </div>
  );
}

function ResultRail(input: {
  title: string;
  modeLabel: string;
  summary: string;
  subline: string;
  body: string;
  emptyText: string;
  copyPrompt: () => void;
}) {
  const isVideo = input.title.includes("视频");
  return (
    <aside className={isVideo ? "resultRail videoResultRail" : "resultRail"}>
      <div className="queueCard">
        <span>{isVideo ? "视频任务状态" : "图片任务状态"}</span>
        <strong>{input.modeLabel}</strong>
        <div className="queueMeta">
          <div className="queueStat"><b>0</b><small>任务</small></div>
          <div className="queueStat"><b>0</b><small>{isVideo ? "视频" : "图片"}</small></div>
          <div className="queueStat"><b>0/0</b><small>进度</small></div>
        </div>
        <div className="progressBar"><i /></div>
      </div>

      <div className="resultPanel">
        <div className="panelHeader">
          <span>{input.title}</span>
          <strong>0 个结果</strong>
        </div>
        <div className="resultEmpty">
          <strong>等待生成</strong>
          <span>{input.emptyText}</span>
        </div>
      </div>

      {isVideo ? (
        <div className="videoUpscaleResultBox">
          <span>高清输出</span>
          <div>
            {upscaleVideoQualities.map((item) => (
              <button disabled key={item.id} type="button">{item.label}</button>
            ))}
          </div>
          <em>会进入独立高清输出工作台，单独创建任务、记录积分和成本。</em>
          <a className="downloadVideoButton" href="/video-upscale">
            视频高清转换器
          </a>
        </div>
      ) : null}

      <div className="recordShortcutCard">
        <span>{isVideo ? "视频生成记录" : "图片生成记录"}</span>
        <strong>{input.summary}</strong>
        <em>{input.subline}</em>
        <a href={isVideo ? "/generation-records?tab=videos" : "/generation-records?tab=images"}>查看生成记录</a>
      </div>
    </aside>
  );
}
