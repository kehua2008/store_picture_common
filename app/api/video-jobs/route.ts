import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../src/server/auth";
import { rechargeOrderRepository, videoJobService } from "../../../src/server/services";
import { persistentUploadSubdir } from "../../../src/server/storagePaths";

const maxImageBytes = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  await videoJobService.runDueJobs();
  const scope = new URL(request.url).searchParams.get("scope") === "all" ? "all" : "mine";
  const jobs = await videoJobService.list(auth.user.id);
  return NextResponse.json({ jobs: jobs.filter((job) => scope === "all" || !job.createdByActorId || job.createdByActorId === auth.actor.actorId) });
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (auth.user.status !== "active") return NextResponse.json({ error: "account_suspended" }, { status: 403 });
  if (!process.env.YUNWU_API_KEY?.trim()) return NextResponse.json({ error: "video_provider_not_configured", message: "生视频服务暂未配置，请稍后重试或联系管理员。" }, { status: 503 });
  const form = await request.formData().catch(() => undefined);
  if (!form) return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });
  const images = form.getAll("images").filter(isImageFile);
  if (!images.length) return NextResponse.json({ error: "missing_image_upload", message: "请至少上传一张商品图片。" }, { status: 400 });
  if (images.some((image) => image.size > maxImageBytes)) return NextResponse.json({ error: "image_file_too_large", maxBytes: maxImageBytes }, { status: 400 });
  const plan = await rechargeOrderRepository.pricingPlanForCustomer(auth.user.id);
  const reservedCredits = plan.videoCreditsPerUnit;
  const account = await rechargeOrderRepository.account(auth.user.id);
  if (account.balanceCredits < reservedCredits) return NextResponse.json({ error: "insufficient_credits", requiredCredits: reservedCredits, account }, { status: 402 });
  const batch = `video-${crypto.randomUUID()}`;
  const baseUrl = publicBaseUrl(request);
  if (!baseUrl) return NextResponse.json({ error: "public_base_url_required", message: "视频生成需要可供模型访问的公网素材地址，请配置 APP_PUBLIC_BASE_URL。" }, { status: 503 });
  const urls = await Promise.all(images.slice(0, 6).map((image, index) => storeVideoImage(batch, index, image, baseUrl)));
  const duration = clampNumber(form.get("durationSeconds"), 5, 1, 15);
  const job = await videoJobService.createJob({
    customerId: auth.user.id,
    createdByActorId: auth.actor.actorId,
    createdByActorName: auth.actor.actorName,
    prompt: formText(form, "prompt") ?? "根据商品图片生成真实、干净、适合电商使用的商品短视频。保持商品外形、颜色、材质、包装和可见结构一致，不添加不存在的配件、功能、品牌或夸张文字。",
    images: urls,
    aspectRatio: formText(form, "aspectRatio") ?? "9:16",
    durationSeconds: duration,
    outputResolution: formText(form, "outputResolution") === "720p" ? "720p" : "480p",
    reservedCredits
  });
  try {
    await rechargeOrderRepository.reserveGenerationCredits({ customerId: auth.user.id, generationJobId: job.id, credits: reservedCredits, actorId: auth.actor.actorId, actorName: auth.actor.actorName, reason: "创建视频任务冻结预计积分" });
  } catch (error) {
    await videoJobService.cancel(job.id);
    return NextResponse.json({ error: error instanceof Error && error.message === "insufficient_credits" ? "insufficient_credits" : "credit_reservation_failed" }, { status: 402 });
  }
  void videoJobService.run(job.id);
  return NextResponse.json({ job }, { status: 202 });
}

function isImageFile(value: FormDataEntryValue): value is File { return typeof value === "object" && value !== null && "size" in value && "name" in value && Number(value.size) > 0 && String((value as File).type).startsWith("image/"); }
async function storeVideoImage(batch: string, index: number, file: File, baseUrl: string): Promise<string> { const directory = persistentUploadSubdir(path.join("video-sources", batch)); await mkdir(directory, { recursive: true }); const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png"; const filename = `${index + 1}-${safe(file.name)}.${extension}`; await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer())); return `${baseUrl}/video-sources/${encodeURIComponent(batch)}/${encodeURIComponent(filename)}`; }
function publicBaseUrl(request: Request): string | undefined { const configured = process.env.APP_PUBLIC_BASE_URL?.trim(); if (configured) return configured.replace(/\/$/, ""); const origin = new URL(request.url).origin; return /^https?:\/\//.test(origin) && !/127\.0\.0\.1|localhost/.test(origin) ? origin : undefined; }
function formText(form: FormData, key: string): string | undefined { const value = form.get(key); return typeof value === "string" && value.trim() ? value.trim().slice(0, 8_000) : undefined; }
function clampNumber(value: FormDataEntryValue | null, fallback: number, min: number, max: number) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback; }
function safe(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "image"; }
