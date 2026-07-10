export type CreditPlanId = "credits-990" | "credits-2990" | "credits-9990" | "credits-29990" | "credits-49990" | "credits-99990";

export interface CreditRechargePlan {
  id: CreditPlanId;
  credits: number;
  priceCny: number;
  label: string;
  badge?: string;
  description: string;
  customerType: string;
  imageCreditsPerUnit: number;
  videoCreditsPerUnit: number;
}

export type CreditChargeRuleId =
  | "single-main"
  | "detail-poster"
  | "detail-module"
  | "multi-angle"
  | "custom-style"
  | "style-reference-analysis"
  | "custom-model"
  | "quality-check"
  | "video-prompt-writer"
  | "video-prompt-revise"
  | "short-video";

export interface CreditChargeRule {
  id: CreditChargeRuleId;
  item: string;
  scenario: string;
  credits: number;
  unit: string;
  formula: string;
  note: string;
}

export const creditUnitPriceCny = 0.1;
export const baseImageCreditCost = 30;
export const detailModuleImageCreditMultiplier = 1.2;
export const detailPosterImageCreditMultiplier = 1.5;
export const videoPromptWriterCredits = 10;
export const videoPromptReviseCredits = 10;
export const qualityCheckCredits = 5;
export const styleReferenceAnalysisCredits = 10;

export const creditRechargePlans: CreditRechargePlan[] = [
  {
    id: "credits-990",
    credits: 990,
    priceCny: 99,
    label: "990 积分",
    description: "适合小批量试用和单款上新",
    customerType: "散户试用",
    imageCreditsPerUnit: 30,
    videoCreditsPerUnit: 300
  },
  {
    id: "credits-2990",
    credits: 2990,
    priceCny: 299,
    label: "2990 积分",
    description: "适合轻度商家日常出图",
    customerType: "轻度商家",
    imageCreditsPerUnit: 25,
    videoCreditsPerUnit: 280
  },
  {
    id: "credits-9990",
    credits: 9990,
    priceCny: 999,
    label: "9990 积分",
    badge: "商家常用",
    description: "适合稳定上新和批量图片生产",
    customerType: "稳定商家",
    imageCreditsPerUnit: 20,
    videoCreditsPerUnit: 250
  },
  {
    id: "credits-29990",
    credits: 29990,
    priceCny: 2999,
    label: "29990 积分",
    description: "适合小团队批量交付",
    customerType: "小团队",
    imageCreditsPerUnit: 17,
    videoCreditsPerUnit: 220
  },
  {
    id: "credits-49990",
    credits: 49990,
    priceCny: 4999,
    label: "49990 积分",
    badge: "工作室",
    description: "适合工作室和代运营团队",
    customerType: "工作室",
    imageCreditsPerUnit: 15,
    videoCreditsPerUnit: 200
  },
  {
    id: "credits-99990",
    credits: 99990,
    priceCny: 9999,
    label: "99990 积分",
    badge: "大客户",
    description: "适合高频商家和多成员团队",
    customerType: "大客户",
    imageCreditsPerUnit: 10,
    videoCreditsPerUnit: 200
  }
];

export const creditChargeRules: CreditChargeRule[] = [
  {
    id: "single-main",
    item: "单张主图 / 场景图",
    scenario: "上传 1 张商品图，生成 1 张主图、白底图、场景图或信息流封面",
    credits: baseImageCreditCost,
    unit: "张",
    formula: "散户 30 点/张；大额充值最低 10 点/张",
    note: "按用户最高已审核充值档位扣点；失败不扣点，重新生成按新任务计费。"
  },
  {
    id: "detail-poster",
    item: "详情页首屏海报",
    scenario: "含标题、卖点短文案、海报排版或详情页首屏视觉",
    credits: Math.ceil(baseImageCreditCost * detailPosterImageCreditMultiplier),
    unit: "张",
    formula: "基础图扣点 × 1.5",
    note: "包含文字排版和版式生成，比普通主图增加排版成本。"
  },
  {
    id: "detail-module",
    item: "详情页模块图",
    scenario: "材质、卖点、尺码或局部细节类详情页图片",
    credits: Math.ceil(baseImageCreditCost * detailModuleImageCreditMultiplier),
    unit: "张",
    formula: "基础图扣点 × 1.2",
    note: "需要更强的商品细节一致性，按模块图计费。"
  },
  {
    id: "multi-angle",
    item: "单款多角度输入",
    scenario: "同一个商品上传多张角度图作为一致性参考",
    credits: 0,
    unit: "次",
    formula: "不单独扣点，只按最终生成图片扣点",
    note: "多角度图是输入素材，不是输出结果；不会因为多上传参考图重复扣费。"
  },
  {
    id: "custom-style",
    item: "参考风格图 / 自定义风格",
    scenario: "上传参考图倒推风格，或使用已保存自定义风格",
    credits: 0,
    unit: "次",
    formula: "不单独扣点，只按最终生成图片扣点",
    note: "已解析风格复用不重复扣点；首次解析按参考风格解析规则计费。"
  },
  {
    id: "style-reference-analysis",
    item: "参考风格解析",
    scenario: "首次上传参考风格图并倒推出结构化分析和可复用 Prompt",
    credits: styleReferenceAnalysisCredits,
    unit: "次",
    formula: "未命中图片 hash 时 × 10",
    note: "同一图片 hash 已解析过不重复扣费；解析成功入库后即成为可复用资产。"
  },
  {
    id: "custom-model",
    item: "专属模特照片",
    scenario: "上传人脸照片并作为模特一致性引导",
    credits: 0,
    unit: "次",
    formula: "保存不扣点，生成时按图片类型扣点",
    note: "如果后续接入高精度换脸/训练模型，可单独配置训练费用。"
  },
  {
    id: "quality-check",
    item: "质量检查",
    scenario: "检查商品一致性、平台合规、文字和画面风险",
    credits: qualityCheckCredits,
    unit: "张",
    formula: "检查张数 × 5",
    note: "当前可作为增值项；默认生图不强制扣除。"
  },
  {
    id: "video-prompt-writer",
    item: "AI 视频提示词代写",
    scenario: "根据商品图和用户需求生成短视频脚本/提示词",
    credits: videoPromptWriterCredits,
    unit: "次",
    formula: "代写次数 × 10",
    note: "调用成功后扣点；供应商失败不扣点。"
  },
  {
    id: "video-prompt-revise",
    item: "AI 视频提示词改写",
    scenario: "按修改意见重新改写短视频脚本/提示词",
    credits: videoPromptReviseCredits,
    unit: "次",
    formula: "改写次数 × 10",
    note: "调用成功后扣点；供应商失败不扣点。"
  },
  {
    id: "short-video",
    item: "短视频草稿",
    scenario: "根据图片或文本生成短视频方案、分镜或视频草稿",
    credits: 300,
    unit: "条",
    formula: "散户 300 点/条；大额充值最低 200 点/条",
    note: "创建任务先冻结预计积分；供应商接收任务后扣除冻结积分；创建失败、参数拒绝或取消会释放冻结积分。"
  }
];

export const creditChargePrinciples = [
  "失败任务不扣点；取消中的任务如果尚未进入模型生成阶段不扣点。",
  "只上传素材、参考图、专属模特或保存自定义风格不扣点。",
  "同一任务生成多张结果时按输出张数累计扣点。",
  "图片和视频按用户最高已审核充值档位分别享受扣点优惠。",
  "平台规格本身不加价，只有图片类型、生成张数、视频和增值检查影响扣点。",
  "未来接入更高分辨率、精修、视频模型或训练模型时，可在此规则上增加倍率。"
];

export function estimateBaseImageCount(credits: number): number {
  return Math.floor(credits / baseImageCreditCost);
}

export function estimatePlanBaseImageCount(plan: CreditRechargePlan): number {
  return Math.floor(plan.credits / plan.imageCreditsPerUnit);
}

export function estimatePlanVideoCount(plan: CreditRechargePlan): number {
  return Math.floor(plan.credits / plan.videoCreditsPerUnit);
}

export function unitImagePriceCny(plan: CreditRechargePlan): number {
  const imageCount = estimatePlanBaseImageCount(plan);
  return imageCount > 0 ? plan.priceCny / imageCount : 0;
}

export function creditsForRule(id: CreditChargeRuleId): number {
  return creditChargeRules.find((rule) => rule.id === id)?.credits ?? 0;
}

export function defaultCreditRechargePlan(): CreditRechargePlan {
  return creditRechargePlans[0];
}

export function creditRechargePlanById(planId: string | undefined): CreditRechargePlan {
  const legacyPlanMap: Record<string, CreditPlanId> = {
    "credits-1000": "credits-990",
    "credits-5000": "credits-2990",
    "credits-10000": "credits-9990",
    "credits-50000": "credits-49990",
    "credits-100000": "credits-99990"
  };
  const normalizedPlanId = planId && legacyPlanMap[planId] ? legacyPlanMap[planId] : planId;
  return creditRechargePlans.find((plan) => plan.id === normalizedPlanId) ?? defaultCreditRechargePlan();
}

export function imageCreditsForType(imageTypeId: string, plan: CreditRechargePlan): number {
  return imageCreditsForUnit(imageTypeId, plan.imageCreditsPerUnit);
}

export function imageCreditsForUnit(imageTypeId: string, imageCreditsPerUnit: number): number {
  if (imageTypeId === "detail_header_poster") return Math.ceil(imageCreditsPerUnit * detailPosterImageCreditMultiplier);
  if (imageTypeId.startsWith("detail_")) return Math.ceil(imageCreditsPerUnit * detailModuleImageCreditMultiplier);
  return imageCreditsPerUnit;
}
