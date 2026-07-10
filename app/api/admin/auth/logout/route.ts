import { NextResponse } from "next/server";
import { buildExpiredSessionCookie, getAuthContextFromRequest } from "../../../../../src/server/auth";
import { userRepository } from "../../../../../src/server/services";

export async function POST(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (auth) await userRepository.deleteSession(auth.sessionId);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": buildExpiredSessionCookie() } });
}
