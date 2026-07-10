import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "../../../src/server/auth";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  return NextResponse.json({ jobs: [] });
}
