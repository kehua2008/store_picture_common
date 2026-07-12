import { FileRechargeOrderRepository } from "../domain/billing/rechargeOrders";
import { FileUserRepository } from "../domain/auth/users";
import { FilePasswordRecoveryRepository } from "../domain/auth/passwordRecovery";
import { FileFeedbackReportRepository } from "../domain/feedback/feedbackReports";
import { FileGenerationJobRepository } from "../domain/jobs/generationJobs";
import { GenerationJobService } from "../domain/jobs/generationJobs";
import { YunwuImageProvider } from "../domain/provider/yunwuImageProvider";
import { FileVideoJobRepository, VideoJobService } from "../domain/jobs/videoJobs";
import { YunwuVideoProvider } from "../domain/provider/yunwuVideoProvider";
import { analyzeStyleSample, FileStyleLibraryRepository, inferStyleName } from "../domain/styleLibrary/styleLibrary";
import { createStyleVisionAnalyzer } from "../domain/styleLibrary/styleVisionAnalyzer";

const styleVisionAnalyzer = createStyleVisionAnalyzer({
  analyze: analyzeStyleSample,
  inferStyleName
});

export const userRepository = new FileUserRepository();
export const passwordRecoveryRepository = new FilePasswordRecoveryRepository();
export const rechargeOrderRepository = new FileRechargeOrderRepository();
export const feedbackReportRepository = new FileFeedbackReportRepository();
const generationJobRepository = new FileGenerationJobRepository();
export const generationJobService = new GenerationJobService(generationJobRepository, new YunwuImageProvider(), {
  async onSucceeded(job) {
    if (!job.reservedCredits) return;
    const charge = Math.min(job.reservedCredits, job.chargedCredits);
    if (charge > 0) {
      await rechargeOrderRepository.debitReservedGenerationCredits({
        customerId: job.customerId,
        generationJobId: job.id,
        credits: charge,
        actorId: job.createdByActorId,
        actorName: job.createdByActorName,
        reason: job.status === "partial_failed" ? "生图任务部分成功，扣除已完成图片积分" : "生图任务成功，扣除冻结积分"
      });
    }
    const release = Math.max(0, job.reservedCredits - charge);
    if (release > 0) await rechargeOrderRepository.releaseReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: release, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "生图任务未完成部分，释放剩余冻结积分" });
  },
  async onFailed(job) {
    if (job.reservedCredits) await rechargeOrderRepository.releaseReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: job.reservedCredits, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "生图任务失败，释放冻结积分" });
  },
  async onCanceled(job) {
    if (job.reservedCredits) await rechargeOrderRepository.releaseReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: job.reservedCredits, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "生图任务取消，释放冻结积分" });
  }
});
const videoJobRepository = new FileVideoJobRepository();
export const videoJobService = new VideoJobService(videoJobRepository, new YunwuVideoProvider(), {
  async onSubmitted(job) {
    if (job.reservedCredits) await rechargeOrderRepository.debitReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: job.reservedCredits, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "视频任务已提交模型，扣除冻结积分" });
  },
  async onFailed(job) {
    if (job.reservedCredits) await rechargeOrderRepository.releaseReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: job.reservedCredits, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "视频任务失败，释放冻结积分" });
  },
  async onCanceled(job) {
    if (job.reservedCredits) await rechargeOrderRepository.releaseReservedGenerationCredits({ customerId: job.customerId, generationJobId: job.id, credits: job.reservedCredits, actorId: job.createdByActorId, actorName: job.createdByActorName, reason: "视频任务取消，释放冻结积分" });
  }
});
export const styleLibraryRepository = new FileStyleLibraryRepository({ analyzer: styleVisionAnalyzer });

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const generationRunner = globalThis as typeof globalThis & { __commonGenerationRunner?: ReturnType<typeof setInterval> };
if (!isBuild && !generationRunner.__commonGenerationRunner) {
  generationRunner.__commonGenerationRunner = setInterval(() => { void generationJobService.runDueJobs(); void videoJobService.runDueJobs(); }, 10_000);
  generationRunner.__commonGenerationRunner.unref?.();
  void generationJobService.runDueJobs();
  void videoJobService.runDueJobs();
}

export function isImageGenerationProviderConfigured(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.YUNWU_API_KEY?.trim());
}
