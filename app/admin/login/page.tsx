"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { describeRequestFailure, readJsonRecord } from "@/client/httpStatus";

type AdminUser = {
  id: string;
  phone: string;
  displayName?: string;
  status: "active" | "suspended";
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginShell status="正在加载后台登录..." />}>
      <AdminLoginContent />
    </Suspense>
  );
}

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams]);
  const [phone, setPhone] = useState("17705072626");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState<AdminUser>();
  const [status, setStatus] = useState("请输入管理员手机号和密码");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refreshAdmin();
  }, []);

  async function refreshAdmin() {
    const response = await fetch("/api/admin/auth/me").catch(() => undefined);
    if (!response?.ok) return;
    const body = await readJsonRecord(response);
    if (body.user && typeof body.user === "object") {
      setAdminUser(body.user as AdminUser);
      setStatus("管理员已登录，可直接进入后台");
    }
  }

  async function login() {
    setSubmitting(true);
    setStatus("正在验证管理员身份...");
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    }).catch(() => undefined);
    setSubmitting(false);

    if (!response) {
      setStatus("登录失败：网络请求失败，请稍后重试");
      return;
    }

    const body = await readJsonRecord(response);
    if (!response.ok) {
      setStatus(adminLoginError(response, body));
      return;
    }

    setAdminUser(body.user as AdminUser);
    setStatus("管理员登录成功，正在进入后台...");
    router.push(nextPath);
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    setAdminUser(undefined);
    setPassword("");
    setStatus("已退出后台，请重新登录");
  }

  return (
    <AdminLoginShell status={status}>
      <section className="adminLoginPanel" aria-label="管理员登录">
        <header>
          <span>手机号白名单</span>
          <strong>{adminUser ? "后台已连接" : "验证管理员"}</strong>
        </header>
        {adminUser ? (
          <div className="adminLoginProfile">
            <span>当前管理员</span>
            <strong>{adminUser.phone}</strong>
            <em>{adminUser.displayName || adminUser.id}</em>
          </div>
        ) : (
          <div className="adminLoginForm">
            <label>
              管理员手机号
              <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label>
              密码
              <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button disabled={submitting || !phone.trim() || !password} type="button" onClick={() => void login()}>
              {submitting ? "验证中..." : "登录管理后台"}
            </button>
          </div>
        )}
        <p className="adminLoginStatus">{status}</p>
        <div className="adminLoginActions">
          <Link href={nextPath}>进入后台</Link>
          {adminUser ? <button type="button" onClick={() => void logout()}>退出后台</button> : null}
        </div>
      </section>
    </AdminLoginShell>
  );
}

function AdminLoginShell({ children, status }: { children?: ReactNode; status: string }) {
  return (
    <main className="adminLoginPage">
      <section className="adminLoginHero">
        <Link className="adminLoginBrand" href="/">
          <img alt="" src="/brand-logo.svg" />
          <span>通用百货AI创作平台</span>
        </Link>
        <div>
          <span>Admin Console</span>
          <h1>管理后台登录</h1>
          <p>后台只允许白名单手机号进入。管理员身份由服务器环境变量确认，不在页面里开放自助授权。</p>
        </div>
      </section>
      {children ?? (
        <section className="adminLoginPanel" aria-label="管理员登录">
          <header>
            <span>手机号白名单</span>
            <strong>后台入口</strong>
          </header>
          <p className="adminLoginStatus">{status}</p>
        </section>
      )}
    </main>
  );
}

function sanitizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/admin/") || value.startsWith("/admin/login")) return "/admin/members";
  return value;
}

function adminLoginError(response: Response, body: Record<string, unknown>): string {
  if (body.error === "admin_required") return "登录失败：该手机号未加入管理员白名单";
  if (body.error === "invalid_phone_or_password") return "登录失败：手机号或密码不正确";
  if (body.error === "account_suspended") return "登录失败：该账号已停用";
  return describeRequestFailure("登录失败", response, body);
}
