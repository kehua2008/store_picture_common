import { NextResponse } from "next/server";
import { requireAdminAuth } from "../../../../src/server/auth";

export async function GET(request: Request) {
  const admin = await requireAdminAuth(request);
  if (!admin.auth) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const provider = process.env.STYLE_VISION_PROVIDER ?? (process.env.NODE_ENV === "test" ? "heuristic" : "openai_compatible");
  return NextResponse.json({
    provider,
    configured: provider === "openai_compatible" ? Boolean(process.env.STYLE_VISION_API_KEY ?? process.env.YUNWU_API_KEY) : true,
    baseUrl: provider === "openai_compatible" ? process.env.STYLE_VISION_BASE_URL ?? process.env.YUNWU_BASE_URL ?? "https://yunwu.ai" : undefined,
    model: provider === "openai_compatible" ? process.env.STYLE_VISION_MODEL || "gpt-4o-mini" : undefined
  });
}
