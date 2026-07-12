import { NextResponse } from "next/server";
import { normalizePhone } from "../../../../../src/domain/auth/passwordRecovery";
import { userRepository, passwordRecoveryRepository } from "../../../../../src/server/services";
import { isRecoverySmsConfigured, sendRecoverySms, SmsServiceError } from "../../../../../src/server/aliyunSms";
import { requestIp, stringField } from "../../../../../src/server/recoveryRequest";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const phone = normalizePhone(stringField((body as Record<string, unknown> | undefined)?.phone));
  // The response intentionally does not reveal whether this phone owns an account.
  try {
    if (!isRecoverySmsConfigured("password_reset")) return NextResponse.json({ error: "sms_not_configured" }, { status: 503 });
    const user = await userRepository.findByPhone(phone);
    if (user?.status === "active") {
      const issued = await passwordRecoveryRepository.issueCode({ purpose: "password_reset", originalPhone: phone, deliveryPhone: phone, ip: requestIp(request) });
      await sendRecoverySms({ purpose: "password_reset", phone, code: issued.code });
    } else {
      await passwordRecoveryRepository.recordSendAttempt({ purpose: "password_reset", deliveryPhone: phone, ip: requestIp(request) });
    }
    return NextResponse.json({ accepted: true, message: "如该手机号已注册，验证码将发送至该手机号。" });
  } catch (error) {
    if (error instanceof SmsServiceError) return NextResponse.json({ error: error.code }, { status: error.code === "sms_not_configured" ? 503 : 502 });
    const code = error instanceof Error ? error.message : "password_reset_send_failed";
    return NextResponse.json({ error: code }, { status: code === "too_many_requests" ? 429 : 400 });
  }
}
