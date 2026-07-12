import { createHmac, randomUUID } from "crypto";
import type { RecoveryCodePurpose } from "../domain/auth/passwordRecovery";

export class SmsServiceError extends Error {
  constructor(public readonly code: "sms_not_configured" | "sms_send_failed") {
    super(code);
  }
}

export async function sendRecoverySms(input: { purpose: RecoveryCodePurpose; phone: string; code: string }): Promise<void> {
  const config = smsConfig(input.purpose);
  if (!config) throw new SmsServiceError("sms_not_configured");

  const parameters: Record<string, string> = {
    AccessKeyId: config.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: input.phone,
    RegionId: "cn-hangzhou",
    SignName: config.signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: config.templateCode,
    TemplateParam: JSON.stringify({ code: input.code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25"
  };
  const signature = createSignature(parameters, config.accessKeySecret);
  const url = `https://dysmsapi.aliyuncs.com/?${toQuery({ ...parameters, Signature: signature })}`;
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new SmsServiceError("sms_send_failed");
  }
  const payload = await response.json().catch(() => undefined) as { Code?: string } | undefined;
  if (!response.ok || payload?.Code !== "OK") throw new SmsServiceError("sms_send_failed");
}

export function isRecoverySmsConfigured(purpose: RecoveryCodePurpose): boolean {
  return Boolean(smsConfig(purpose));
}

function smsConfig(purpose: RecoveryCodePurpose): { accessKeyId: string; accessKeySecret: string; signName: string; templateCode: string } | undefined {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET?.trim();
  const signName = process.env.ALIYUN_SMS_SIGN_NAME?.trim();
  const templateCode = purpose === "manual_recovery_reset"
    ? process.env.ALIYUN_SMS_MANUAL_RECOVERY_TEMPLATE_CODE?.trim()
    : process.env.ALIYUN_SMS_PASSWORD_RESET_TEMPLATE_CODE?.trim();
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) return undefined;
  return { accessKeyId, accessKeySecret, signName, templateCode };
}

function createSignature(parameters: Record<string, string>, accessKeySecret: string): string {
  const stringToSign = `GET&%2F&${percentEncode(toQuery(parameters))}`;
  return createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
}

function toQuery(parameters: Record<string, string>): string {
  return Object.keys(parameters).sort().map((key) => `${percentEncode(key)}=${percentEncode(parameters[key] ?? "")}`).join("&");
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
