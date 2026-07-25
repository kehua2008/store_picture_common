import { NextResponse } from "next/server";
import { z } from "zod";
import { creditsForRule } from "../../../src/domain/billing/creditPlans";
import { createVideoPromptWriter, VideoPromptWriterError } from "../../../src/domain/video/videoPromptWriter";
import { getAuthContextFromRequest } from "../../../src/server/auth";
import { rechargeOrderRepository } from "../../../src/server/services";

const requestSchema = z.object({
  mode: z.enum(["draft", "revise"]),
  brief: z.string().max(2_000).optional(),
  currentScript: z.string().max(8_000).optional(),
  revision: z.string().max(2_000).optional(),
  productImages: z.array(z.string().startsWith("data:image/").max(12_000_000)).min(1).max(3),
  category: z.string().min(1).max(80),
  videoGoal: z.string().min(1).max(80),
  platform: z.string().min(1).max(80),
  durationSeconds: z.number().int().min(1).max(15),
  outputResolution: z.enum(["480p", "720p"]),
  musicMode: z.string().min(1).max(80),
  voiceoverMode: z.string().min(1).max(80),
  subtitleMode: z.string().min(1).max(80)
});

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required", message: "请先登录账号后使用 AI 提示词代写。" }, { status: 401 });
  if (auth.user.status !== "active") return NextResponse.json({ error: "account_suspended", message: "账号已暂停使用。" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "invalid_video_prompt_writer_request", message: "提示词代写请求参数不完整。" }, { status: 400 });
  if (parsed.data.mode === "revise" && (!parsed.data.currentScript?.trim() || !parsed.data.revision?.trim())) {
    return NextResponse.json({ error: "missing_revision", message: "请先提供当前提示词和补充修改意见。" }, { status: 400 });
  }

  const credits = creditsForRule(parsed.data.mode === "revise" ? "video-prompt-revise" : "video-prompt-writer");
  const account = await rechargeOrderRepository.account(auth.user.id);
  if (account.balanceCredits < credits) return NextResponse.json({ error: "insufficient_credits", message: "积分不足，无法使用 AI 提示词代写。", requiredCredits: credits }, { status: 402 });
  try {
    const result = await createVideoPromptWriter().write(parsed.data);
    await rechargeOrderRepository.debitUsageCredits({
      customerId: auth.user.id,
      credits,
      actorId: auth.actor.actorId,
      actorName: auth.actor.actorName,
      reason: parsed.data.mode === "revise" ? "AI 视频提示词改写成功，扣除积分" : "AI 视频提示词代写成功，扣除积分"
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VideoPromptWriterError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: "video_prompt_writer_failed", message: "AI提示词代写失败，请稍后重试。" }, { status: 500 });
  }
}
