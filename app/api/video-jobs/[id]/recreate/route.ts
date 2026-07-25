import { NextResponse } from "next/server";
import { estimateVideoTaskCredits } from "../../../../../src/domain/billing/creditPlans";
import { buildVideoRenderScenes, type VideoRenderMode } from "../../../../../src/domain/jobs/videoJobs";
import { nativeAudioVideoAvailable } from "../../../../../src/domain/provider/yunwuVideoProvider";
import { getAuthContextFromRequest } from "../../../../../src/server/auth";
import { rechargeOrderRepository, videoJobService } from "../../../../../src/server/services";
import { FfmpegVideoComposer } from "../../../../../src/server/videoComposer";

videoJobService.useComposer(new FfmpegVideoComposer());

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const source = await videoJobService.get((await context.params).id);
  if (!source || source.customerId !== auth.user.id || (source.createdByActorId && source.createdByActorId !== auth.actor.actorId)) {
    return NextResponse.json({ error: "video_job_not_found" }, { status: 404 });
  }
  if (["succeeded", "failed", "canceled"].includes(source.status) || source.replacedByJobId) {
    return NextResponse.json({ error: "video_job_cannot_be_recreated", message: "该任务不能按新版重新创建。" }, { status: 409 });
  }
  if (!source.creativePlan || !source.images.length) {
    return NextResponse.json({ error: "video_job_source_unavailable", message: "原任务缺少可复用的素材或脚本。" }, { status: 409 });
  }

  const canceled = await videoJobService.cancel(source.id);
  if (!canceled || canceled.status !== "canceled") return NextResponse.json({ error: "video_job_cannot_be_canceled", message: "原任务无法停止。" }, { status: 409 });
  if (canceled.chargedCredits) {
    await rechargeOrderRepository.refundDebitedGenerationCredits({ customerId: canceled.customerId, generationJobId: canceled.id, credits: canceled.chargedCredits, actorId: canceled.createdByActorId, actorName: canceled.createdByActorName, reason: "按新版整片视频重做，退回原任务积分" });
  }

  const pricingPlan = await rechargeOrderRepository.pricingPlanForCustomer(auth.user.id);
  const reservedCredits = estimateVideoTaskCredits(pricingPlan, source.images.length);
  const account = await rechargeOrderRepository.account(auth.user.id);
  if (account.balanceCredits < reservedCredits) {
    return NextResponse.json({ error: "insufficient_credits", requiredCredits: reservedCredits, account, canceledJob: canceled }, { status: 402 });
  }

  const renderMode: VideoRenderMode = nativeAudioVideoAvailable() ? "native_full" : "segmented_fallback";
  const replacement = await videoJobService.createJob({
    customerId: source.customerId,
    createdByActorId: source.createdByActorId,
    createdByActorName: source.createdByActorName,
    prompt: source.prompt,
    images: source.images,
    aspectRatio: source.aspectRatio,
    durationSeconds: source.durationSeconds,
    outputResolution: source.outputResolution,
    reservedCredits,
    creativePlan: source.creativePlan,
    renderMode,
    replacedJobId: source.id,
    scenes: buildVideoRenderScenes(source.creativePlan, renderMode)
  });
  try {
    await rechargeOrderRepository.reserveGenerationCredits({ customerId: replacement.customerId, generationJobId: replacement.id, credits: reservedCredits, actorId: replacement.createdByActorId, actorName: replacement.createdByActorName, reason: "按新版整片视频重做，冻结积分" });
  } catch {
    await videoJobService.cancel(replacement.id);
    return NextResponse.json({ error: "credit_reservation_failed", canceledJob: canceled }, { status: 500 });
  }
  await videoJobService.linkReplacement(source.id, replacement.id);
  void videoJobService.run(replacement.id);
  return NextResponse.json({ job: replacement, canceledJob: canceled }, { status: 202 });
}
