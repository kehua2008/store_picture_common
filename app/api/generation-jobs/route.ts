import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../src/server/auth";
import { generationJobService, isImageGenerationProviderConfigured, rechargeOrderRepository } from "../../../src/server/services";
import { persistentDataDir } from "../../../src/server/storagePaths";

const maxImageUploadCount = 12;
const maxImageUploadBytes = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const scope = new URL(request.url).searchParams.get("scope") === "all" ? "all" : "mine";
  const jobs = await generationJobService.listJobsForCustomer(auth.user.id);
  return NextResponse.json({ jobs: jobs.filter((job) => scope === "all" || !job.createdByActorId || job.createdByActorId === auth.actor.actorId) });
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (auth.user.status !== "active") return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  if (!isImageGenerationProviderConfigured()) {
    return NextResponse.json({ error: "image_provider_not_configured", message: "生图服务暂未配置，请稍后重试或联系管理员。" }, { status: 503 });
  }

  const form = await request.formData().catch(() => undefined);
  if (!form) return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });
  const images = form.getAll("images").filter(isImageFile);
  if (!images.length) return NextResponse.json({ error: "missing_image_upload", message: "请至少上传一张商品图片。" }, { status: 400 });
  if (images.length > maxImageUploadCount) return NextResponse.json({ error: "too_many_images", max: maxImageUploadCount }, { status: 400 });
  const oversized = images.find((image) => image.size > maxImageUploadBytes);
  if (oversized) return NextResponse.json({ error: "image_file_too_large", filename: oversized.name, maxBytes: maxImageUploadBytes }, { status: 400 });

  const total = normalizeCount(form.get("total"));
  const plan = await rechargeOrderRepository.pricingPlanForCustomer(auth.user.id);
  const reservedCredits = total * plan.imageCreditsPerUnit;
  const account = await rechargeOrderRepository.account(auth.user.id);
  if (account.balanceCredits < reservedCredits) return NextResponse.json({ error: "insufficient_credits", requiredCredits: reservedCredits, account }, { status: 402 });

  const sourceBatchId = `source-${crypto.randomUUID()}`;
  const sourceImages = await Promise.all(images.map(async (image, index) => ({
    id: `source-${crypto.randomUUID()}`,
    filename: image.name,
    mimeType: image.type || "image/png",
    filePath: await storeSourceImage(sourceBatchId, index, image)
  })));
  const job = await generationJobService.createJob({
    customerId: auth.user.id,
    actorId: auth.actor.actorId,
    actorName: auth.actor.actorName,
    taskLabel: formString(form, "taskLabel"),
    categoryLabel: formString(form, "categoryLabel"),
    promptSummary: formString(form, "promptSummary"),
    promptBody: formString(form, "promptBody") ?? "根据上传的商品图片生成真实、干净、适合电商使用的商品视觉图。保持商品的外形、颜色、材质、包装、标识和可见结构完全一致，不添加不存在的配件、文案、功能或品牌。",
    targetWidth: normalizeDimension(form.get("targetWidth"), 1024),
    targetHeight: normalizeDimension(form.get("targetHeight"), 1024),
    total,
    reservedCredits,
    sourceImages
  });
  try {
    await rechargeOrderRepository.reserveGenerationCredits({
      customerId: auth.user.id,
      generationJobId: job.id,
      credits: reservedCredits,
      actorId: auth.actor.actorId,
      actorName: auth.actor.actorName,
      reason: "创建生图任务冻结预计积分"
    });
  } catch (error) {
    await generationJobService.cancelJob(job.id);
    return NextResponse.json({ error: error instanceof Error && error.message === "insufficient_credits" ? "insufficient_credits" : "credit_reservation_failed" }, { status: 402 });
  }
  void generationJobService.runJob(job.id);
  return NextResponse.json({ job }, { status: 202 });
}

function isImageFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "size" in value && "name" in value && Number(value.size) > 0 && String((value as File).type).startsWith("image/");
}

async function storeSourceImage(batchId: string, index: number, file: File): Promise<string> {
  const directory = path.join(persistentDataDir(), "generation-source-images", safeSegment(batchId));
  await mkdir(directory, { recursive: true });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const destination = path.join(directory, `${index + 1}-${safeSegment(file.name)}.${extension}`);
  await writeFile(destination, Buffer.from(await file.arrayBuffer()));
  return destination;
}

function formString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 8_000) : undefined;
}

function normalizeCount(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(12, Math.trunc(parsed))) : 1;
}

function normalizeDimension(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(512, Math.min(2048, Math.trunc(parsed))) : fallback;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
}
