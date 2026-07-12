import { FileRechargeOrderRepository } from "../domain/billing/rechargeOrders";
import { FileUserRepository } from "../domain/auth/users";
import { FilePasswordRecoveryRepository } from "../domain/auth/passwordRecovery";
import { FileFeedbackReportRepository } from "../domain/feedback/feedbackReports";
import { FileGenerationJobRepository } from "../domain/jobs/generationJobs";
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
export const generationJobRepository = new FileGenerationJobRepository();
export const styleLibraryRepository = new FileStyleLibraryRepository({ analyzer: styleVisionAnalyzer });
