import { NextResponse } from "next/server";
import { passwordRecoveryRepository } from "../../../src/server/services";
import { isUploadedFile, validateImageUploads } from "../../../src/server/uploadValidation";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => undefined);
  if (!formData) return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });
  const description = field(formData.get("description"), 5000);
  if (!description) return NextResponse.json({ error: "missing_recovery_description" }, { status: 400 });
  const proofs = formData.getAll("proofs").filter(isUploadedFile);
  const validation = await validateImageUploads(proofs, {
    maxCount: 3,
    maxBytes: 8 * 1024 * 1024,
    tooManyError: "too_many_recovery_proofs",
    invalidTypeError: "invalid_recovery_proof_type",
    tooLargeError: "recovery_proof_too_large",
    invalidContentError: "invalid_recovery_proof_content"
  });
  if (!validation.files) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const application = await passwordRecoveryRepository.createApplication({
      originalPhone: field(formData.get("originalPhone"), 20) ?? "",
      contactPhone: field(formData.get("contactPhone"), 20) ?? "",
      verificationId: field(formData.get("verificationId"), 120) ?? "",
      description,
      proofs: validation.files
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "account_recovery_submit_failed" }, { status: 400 });
  }
}

function field(value: FormDataEntryValue | null, maxLength: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}
