export const taskIds = [
  "whiteHero",
  "sceneHero",
  "detailCloseup",
  "benefitBase",
  "usageDemo",
  "skuSet",
  "detailPoster",
  "videoCover"
] as const;

export type TaskId = (typeof taskIds)[number];

export const categoryIds = [
  "homeDaily",
  "kitchenDining",
  "storageCleaning",
  "digitalAppliance",
  "beautyPersonal",
  "babyToy",
  "foodGift",
  "sportsOutdoor",
  "autoAccessory",
  "officeStationery",
  "general"
] as const;

export type CategoryId = (typeof categoryIds)[number];

export const styleIds = [
  "cleanWhite",
  "modernHome",
  "premiumMaterial",
  "brightFresh",
  "functionalTech",
  "naturalLife",
  "giftMood",
  "liveCommerce",
  "socialLifestyle",
  "shortVideoImpact"
] as const;

export type StyleId = (typeof styleIds)[number];

export const strengthIds = ["safe", "balanced", "bold"] as const;
export type StrengthId = (typeof strengthIds)[number];

export const suiteIds = ["listing", "detail", "video"] as const;
export type SuiteId = (typeof suiteIds)[number];

export interface OptionMeta<T extends string> {
  id: T;
  label: string;
  desc: string;
  prompt: string;
}

export const tasks: OptionMeta<TaskId>[] = [
  {
    id: "whiteHero",
    label: "白底主图",
    desc: "完整商品、纯净背景、审核友好",
    prompt: "Image role: clean white-background hero. Keep the full product centered, complete, sharp-edged, color-accurate, with realistic soft grounding shadow and no props."
  },
  {
    id: "sceneHero",
    label: "场景主图",
    desc: "把商品放进可信使用环境",
    prompt: "Image role: ecommerce scene hero. Place the product in a realistic use context that explains its purpose, with the product as the first visual priority and the background lower contrast."
  },
  {
    id: "detailCloseup",
    label: "细节特写",
    desc: "材质、结构、接口、做工近景",
    prompt: "Image role: macro detail close-up. Show one truthful material, structure, finish, opening, button, connector, texture, packaging edge, or craftsmanship feature per image."
  },
  {
    id: "benefitBase",
    label: "功能卖点图",
    desc: "画面留白，方便后期加标签",
    prompt: "Image role: benefit-label base image. Leave clean negative space for 1-3 external feature labels; do not generate text in the image."
  },
  {
    id: "usageDemo",
    label: "使用示意图",
    desc: "手持、摆放、安装、打开、收纳",
    prompt: "Image role: use demonstration. Show a credible hand operation, placement, installation, opening, storage, before-use/after-use cue, or daily-use action without inventing false product functions."
  },
  {
    id: "skuSet",
    label: "套装/SKU图",
    desc: "多规格、多颜色、多件套展示",
    prompt: "Image role: SKU or set overview. Arrange variants or bundled items clearly and orderly, keep color and scale consistent, avoid lifestyle clutter."
  },
  {
    id: "detailPoster",
    label: "详情页首屏",
    desc: "更有氛围的详情海报",
    prompt: "Image role: detail-page first-screen poster. Use a richer commerce scene with premium spacing and poster composition; text is allowed only when merchant copy is explicitly supplied."
  },
  {
    id: "videoCover",
    label: "短视频封面",
    desc: "竖版强首屏、商品大、动作明确",
    prompt: "Image role: vertical short-video cover. Use 3:4 or 9:16 framing, large product readability, strong first-frame composition, light motion cue, and no watermark."
  }
];

export const categories: OptionMeta<CategoryId>[] = [
  {
    id: "homeDaily",
    label: "家居日用",
    desc: "日用品、家纺、小家具、生活杂货",
    prompt: "Category direction: home and daily goods. Use clean living room, bedroom, bathroom, entryway, cabinet, or tabletop context; emphasize material, size, comfort, tidiness, and daily usefulness."
  },
  {
    id: "kitchenDining",
    label: "厨房餐饮",
    desc: "厨具、餐具、水杯、厨房小物",
    prompt: "Category direction: kitchen and dining goods. Use clean countertop, sink, dining table, meal-prep, storage, or serving context; emphasize food-safe cleanliness, capacity, grip, surface, and practical use."
  },
  {
    id: "storageCleaning",
    label: "收纳清洁",
    desc: "收纳盒、清洁工具、整理用品",
    prompt: "Category direction: storage and cleaning. Emphasize compartments, before/after order, capacity, easy-clean surfaces, handles, wheels, folds, refill parts, and tidy functional scenes."
  },
  {
    id: "digitalAppliance",
    label: "数码小电",
    desc: "小家电、配件、桌面数码",
    prompt: "Category direction: digital and small appliances. Emphasize industrial design, buttons, ports, screens, control panels, cable discipline, scale, clean reflections, and technology trust."
  },
  {
    id: "beautyPersonal",
    label: "美妆个护",
    desc: "护肤、美妆、洗护、个护工具",
    prompt: "Category direction: beauty and personal care. Use vanity, bathroom, clean lab, water-fresh, or soft tabletop context; preserve packaging label placement and show texture or hygiene cues."
  },
  {
    id: "babyToy",
    label: "母婴玩具",
    desc: "玩具、喂养、护理、儿童用品",
    prompt: "Category direction: baby and toys. Use soft nursery, clean play, parent-friendly, rounded and safe context; avoid risky handling, adultized styling, messy playroom clutter, and exaggerated safety claims."
  },
  {
    id: "foodGift",
    label: "食品礼盒",
    desc: "零食、生鲜、包装食品、礼盒",
    prompt: "Category direction: food and gift goods. Emphasize package trust, appetizing freshness, ingredient truthfulness, serving clarity, gift-box structure, and no misleading quantity."
  },
  {
    id: "sportsOutdoor",
    label: "运动户外",
    desc: "运动装备、户外用品、露营小物",
    prompt: "Category direction: sports and outdoor. Emphasize durability, ergonomic structure, straps, zippers, weather-ready materials, motion readiness, gym, field, trail, or camping use context."
  },
  {
    id: "autoAccessory",
    label: "汽车用品",
    desc: "车载、内饰、清洁、安装配件",
    prompt: "Category direction: auto accessories. Emphasize installation position, compatibility, vehicle context, practical use, material durability, and clean technical detail."
  },
  {
    id: "officeStationery",
    label: "办公文具",
    desc: "文具、办公收纳、桌面用品",
    prompt: "Category direction: office and stationery. Use tidy desk, notebook, filing, meeting, or study context; emphasize organization, hand scale, clean edges, and productivity."
  },
  {
    id: "general",
    label: "其他",
    desc: "暂未归类的百货商品",
    prompt: "Category direction: general merchandise fallback. Infer the most truthful use context from the reference image, keep the scene simple, and prioritize product recognition over category-specific storytelling."
  }
];

export const styles: OptionMeta<StyleId>[] = [
  {
    id: "cleanWhite",
    label: "干净白场",
    desc: "审核友好、商品检查优先",
    prompt: "Visual style: clean white or light-gray commercial studio, accurate color, controlled shadow, no decorative props."
  },
  {
    id: "modernHome",
    label: "现代家居",
    desc: "真实生活空间，干净有质感",
    prompt: "Visual style: modern home lifestyle, soft daylight, tidy room scale, warm but restrained props, product naturally integrated."
  },
  {
    id: "premiumMaterial",
    label: "高级质感",
    desc: "材质、光影、客单价感",
    prompt: "Visual style: premium material catalog, stone, linen, wood, glass, matte acrylic, controlled highlights, refined negative space."
  },
  {
    id: "brightFresh",
    label: "明亮清爽",
    desc: "高曝光、轻快、点击友好",
    prompt: "Visual style: bright fresh ecommerce, clean high-key light, one or two fresh color accents, crisp edges, cheerful but uncluttered."
  },
  {
    id: "functionalTech",
    label: "功能科技",
    desc: "结构、性能、理性可信",
    prompt: "Visual style: functional technology, graphite or clean white surfaces, precise rim light, interface clarity, structured composition."
  },
  {
    id: "naturalLife",
    label: "自然生活",
    desc: "木质、阳光、真实使用感",
    prompt: "Visual style: natural daily life, window daylight, wood or fabric texture, calm hand-use scene, practical and believable."
  },
  {
    id: "giftMood",
    label: "礼盒氛围",
    desc: "节礼、送礼、组合套装",
    prompt: "Visual style: gift mood, refined arrangement, seasonal accent color, box structure visible, celebratory but not noisy."
  },
  {
    id: "liveCommerce",
    label: "直播电商",
    desc: "直观、信任、手持展示",
    prompt: "Visual style: live-commerce trust, warm real-use lighting, hand scale, product large and direct, no loud price graphics."
  },
  {
    id: "socialLifestyle",
    label: "小红书生活感",
    desc: "自然种草、保存感、轻编辑",
    prompt: "Visual style: tasteful social lifestyle, lived-in but clean, soft natural light, save-worthy composition, no hard-sell poster clutter."
  },
  {
    id: "shortVideoImpact",
    label: "抖音强封面",
    desc: "竖版、动作、强首屏",
    prompt: "Visual style: short-video impact, vertical-first composition, stronger depth, punchier light, product dominant and readable in one second."
  }
];

export const strengths: OptionMeta<StrengthId>[] = [
  {
    id: "safe",
    label: "稳妥上架",
    desc: "少变化、少道具、平台审核友好",
    prompt: "Variation strength: safe. Use low variation, simple background, stable crop, and inspection-first product accuracy."
  },
  {
    id: "balanced",
    label: "平衡转化",
    desc: "默认推荐，有场景但不抢商品",
    prompt: "Variation strength: balanced. Add useful style and context while product identity, shape, color, and function remain dominant."
  },
  {
    id: "bold",
    label: "强点击",
    desc: "适合封面和活动图，视觉更抓眼",
    prompt: "Variation strength: bold. Use stronger scene, light, depth, action, and color, but never alter the product or invent false benefits."
  }
];

export const suites: Array<OptionMeta<SuiteId> & { tasks: TaskId[] }> = [
  {
    id: "listing",
    label: "基础上架包",
    desc: "白底主图 + 场景主图 + 细节图",
    tasks: ["whiteHero", "sceneHero", "detailCloseup"],
    prompt: "Suite strategy: listing-ready pack. Produce one audit-safe hero, one use-context scene, and one truthful material or structure detail."
  },
  {
    id: "detail",
    label: "详情转化包",
    desc: "首屏 + 卖点 + 使用示意 + 细节",
    tasks: ["detailPoster", "benefitBase", "usageDemo", "detailCloseup"],
    prompt: "Suite strategy: detail-page conversion pack. Build a sequence from first impression to benefit area, use proof, and close-up credibility."
  },
  {
    id: "video",
    label: "短视频素材包",
    desc: "竖版封面 + 使用示意 + 场景图",
    tasks: ["videoCover", "usageDemo", "sceneHero"],
    prompt: "Suite strategy: short-video asset pack. Build vertical cover readability, hand/use movement cue, and one supporting lifestyle scene."
  }
];

export function byId<T extends string>(items: OptionMeta<T>[], id: T): OptionMeta<T> {
  return items.find((item) => item.id === id) ?? items[0];
}

export function buildCommonPrompt(input: {
  taskId: TaskId;
  categoryId: CategoryId;
  styleId: StyleId;
  strengthId: StrengthId;
  merchantNote?: string;
}) {
  const task = byId(tasks, input.taskId);
  const category = byId(categories, input.categoryId);
  const style = byId(styles, input.styleId);
  const strength = byId(strengths, input.strengthId);
  const merchantNote = input.merchantNote?.trim();

  const body = [
    "Generate a merchant-ready ecommerce product image from the uploaded product reference.",
    "Product identity lock: preserve the uploaded product's shape, proportions, color, material, packaging structure, main parts, logo/label placement, and visible design details. Do not add nonexistent buttons, ports, accessories, claims, certifications, logos, text, or functions.",
    "Product readability: the product must be the first visual subject, usually occupying 65-80% of the frame when the task allows it. Keep the full silhouette or the selected detail sharp, with clean edges, realistic light, truthful scale, and commercial retouching.",
    task.prompt,
    category.prompt,
    style.prompt,
    strength.prompt,
    merchantNote ? `Merchant note to respect if truthful: ${merchantNote}.` : "",
    task.id === "detailPoster"
      ? "Poster exception: if merchant copy is provided, typography may be concise, scene-aware, and readable. Otherwise do not render text."
      : "No in-image text. Any copy, feature labels, icons, callouts, badges, or prices will be added outside the generated image.",
    "Negative constraints: price tag, discount badge, QR code, platform logo, watermark, dense Chinese copy, random English letters, misspelled text, false certification, exaggerated medical or performance claim, collage border, unrelated props, wrong package, wrong accessory, product deformation, color drift, material change, extra parts, messy background, fake brand, over-retouched unrealistic hand."
  ].filter(Boolean).join("\n\n");

  return {
    summary: `${task.label} / ${category.label} / ${style.label} / ${strength.label}`,
    body
  };
}
