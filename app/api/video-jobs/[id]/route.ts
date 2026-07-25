import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../../src/server/auth";
import { videoJobService } from "../../../../src/server/services";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const job = await videoJobService.get((await context.params).id);
  if (!job || job.customerId !== auth.user.id || (job.createdByActorId && job.createdByActorId !== auth.actor.actorId)) {
    return NextResponse.json({ error: "video_job_not_found" }, { status: 404 });
  }
  if (job.status !== "queued") {
    return NextResponse.json({ error: "video_job_cannot_be_canceled", message: "任务已提交给视频模型，当前无法取消。" }, { status: 409 });
  }
  const canceled = await videoJobService.cancel(job.id);
  return NextResponse.json({ job: canceled });
}
