import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../../src/server/auth";
import { rechargeOrderRepository, videoJobService } from "../../../../src/server/services";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const job = await videoJobService.get((await context.params).id);
  if (!job || job.customerId !== auth.user.id || (job.createdByActorId && job.createdByActorId !== auth.actor.actorId)) {
    return NextResponse.json({ error: "video_job_not_found" }, { status: 404 });
  }
  const canceled = await videoJobService.cancel(job.id);
  if (!canceled || canceled.status !== "canceled") return NextResponse.json({ error: "video_job_cannot_be_canceled", message: "任务已完成或已停止，无法再次取消。" }, { status: 409 });
  if (canceled.chargedCredits) await rechargeOrderRepository.refundDebitedGenerationCredits({ customerId: canceled.customerId, generationJobId: canceled.id, credits: canceled.chargedCredits, actorId: canceled.createdByActorId, actorName: canceled.createdByActorName, reason: "用户主动取消视频任务，退回已扣积分" });
  return NextResponse.json({ job: canceled });
}
