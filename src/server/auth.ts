import { cookies } from "next/headers";
import { userRepository } from "./services";
import type { AuthSession, SessionActor, User } from "../domain/auth/users";

export const authSessionCookieName = "spm_session";

export interface AuthContext {
  user: User;
  sessionId: string;
  actor: SessionActor;
}

export interface AdminAuthCheck {
  auth?: AuthContext;
  error?: "authentication_required" | "admin_required";
  status: 200 | 401 | 403;
}

export async function getAuthContextFromRequest(request: Request): Promise<AuthContext | undefined> {
  const sessionId = parseCookie(request.headers.get("cookie") ?? "")[authSessionCookieName];
  if (!sessionId) return undefined;
  const auth = await userRepository.findSession(sessionId);
  if (!auth) return undefined;
  return { user: auth.user, sessionId, actor: sessionActor(auth.session, auth.user) };
}

export async function getAuthContextFromCookies(): Promise<AuthContext | undefined> {
  const store = await cookies();
  const sessionId = store.get(authSessionCookieName)?.value;
  if (!sessionId) return undefined;
  const auth = await userRepository.findSession(sessionId);
  if (!auth) return undefined;
  return { user: auth.user, sessionId, actor: sessionActor(auth.session, auth.user) };
}

export function buildSessionCookie(sessionId: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${authSessionCookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildExpiredSessionCookie(): string {
  return `${authSessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function requireAdminAuth(request: Request): Promise<AdminAuthCheck> {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return { error: "authentication_required", status: 401 };
  if (!isAdminUser(auth.user)) return { error: "admin_required", status: 403 };
  return { auth, status: 200 };
}

export function isAdminUser(user: User): boolean {
  const adminUserIds = parseAdminList(process.env.ADMIN_USER_IDS);
  const adminPhones = parseAdminList(process.env.ADMIN_PHONE_NUMBERS ?? process.env.ADMIN_PHONES);
  return adminUserIds.has(user.id) || adminPhones.has(user.phone);
}

function parseCookie(header: string): Record<string, string> {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sessionActor(session: AuthSession, user: User): SessionActor {
  const actorName = session.actorName?.trim() || user.displayName?.trim() || `同事${user.phone.slice(-4)}`;
  return {
    actorId: session.actorId || `legacy-session-${session.id.replace(/^session-/, "").slice(0, 16)}`,
    actorName
  };
}

function parseAdminList(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}
