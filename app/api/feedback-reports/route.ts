import { NextResponse } from "next/server";
import { normalizeFeedbackReportStatus, validateFeedbackScreenshots } from "../../../src/domain/feedback/feedbackReports";
import { getAuthContextFromRequest, isAdminUser, requireAdminAuth } from "../../../src/server/auth";
import { feedbackReportRepository } from "../../../src/server/services";
import { isUploadedFile, validateImageUploads } from "../../../src/server/uploadValidation";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const data = await feedbackReportRepository.all(isAdminUser(auth.user) ? undefined : auth.user.id);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const formData = await request.formData().catch(() => undefined);
  if (!formData) return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 });

  const title = value(formData.get("title"), 80);
  const description = value(formData.get("description"), 5000);
  const contact = value(formData.get("contact"), 120);
  if (!title) return NextResponse.json({ error: "missing_feedback_title" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "missing_feedback_description" }, { status: 400 });

  const screenshots = formData.getAll("screenshots").filter(isFileWithName);
  const screenshotError = validateFeedbackScreenshots(screenshots);
  if (screenshotError) return NextResponse.json({ error: screenshotError }, { status: 400 });

  const screenshotValidation = await validateImageUploads(screenshots, {
    maxCount: 3,
    maxBytes: 8 * 1024 * 1024,
    tooManyError: "too_many_feedback_screenshots",
    invalidTypeError: "invalid_feedback_screenshot_type",
    tooLargeError: "feedback_screenshot_too_large",
    invalidContentError: "invalid_feedback_screenshot_content"
  });
  if (!screenshotValidation.files) return NextResponse.json({ error: screenshotValidation.error }, { status: 400 });

  const report = await feedbackReportRepository.create({
    customerId: auth.user.id,
    customerPhone: auth.user.phone,
    actorId: auth.actor.actorId,
    actorName: auth.actor.actorName,
    title,
    description,
    contact,
    screenshots: screenshotValidation.files
  });

  return NextResponse.json({ report }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_feedback_review" }, { status: 400 });

  const payload = body as Record<string, unknown>;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = normalizeFeedbackReportStatus(payload.status);
  if (!id) return NextResponse.json({ error: "missing_feedback_report_id" }, { status: 400 });
  if (!status) return NextResponse.json({ error: "invalid_feedback_status" }, { status: 400 });

  const report = await feedbackReportRepository.review({
    id,
    status,
    adminNote: typeof payload.adminNote === "string" ? payload.adminNote : undefined
  });
  if (!report) return NextResponse.json({ error: "feedback_report_not_found" }, { status: 404 });
  return NextResponse.json({ report });
}

function value(input: FormDataEntryValue | null, maxLength: number): string | undefined {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, maxLength) : undefined;
}

function isFileWithName(value: FormDataEntryValue): value is File {
  return isUploadedFile(value) && "name" in value && typeof value.name === "string" && value.name.length > 0;
}
