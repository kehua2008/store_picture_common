import { NextResponse } from "next/server";
import { toPublicUser } from "../../../../src/domain/auth/users";
import { getAuthContextFromRequest } from "../../../../src/server/auth";
import { rechargeOrderRepository } from "../../../../src/server/services";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ user: null, account: null }, { status: 401 });
  const account = await rechargeOrderRepository.account(auth.user.id);
  return NextResponse.json({ user: toPublicUser(auth.user), account, actor: auth.actor });
}
