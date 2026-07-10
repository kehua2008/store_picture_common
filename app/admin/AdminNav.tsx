"use client";

import Link from "next/link";

type AdminNavKey = "overview" | "members" | "billing" | "recharge" | "feedback" | "style-library";

const adminNavItems: Array<{ key: AdminNavKey; label: string; href: string }> = [
  { key: "overview", label: "后台总览", href: "/admin" },
  { key: "members", label: "客户管理", href: "/admin/members" },
  { key: "billing", label: "财务管理", href: "/admin/billing" },
  { key: "recharge", label: "充值审核", href: "/admin/recharge-orders" },
  { key: "feedback", label: "反馈收件箱", href: "/admin/feedback-reports" },
  { key: "style-library", label: "风格库后台", href: "/admin/style-library" }
];

export function AdminNav({ active }: { active: AdminNavKey }) {
  return (
    <nav className="adminHeaderNav" aria-label="管理员后台导航">
      {adminNavItems.map((item) => (
        <Link className={item.key === active ? "active" : ""} href={item.href} key={item.key}>
          {item.label}
        </Link>
      ))}
      <button className="adminLogoutButton" type="button" onClick={() => void logoutAdmin()}>
        退出后台
      </button>
      <Link className="adminHomeLink" href="/">返回用户端</Link>
    </nav>
  );
}

export function AdminHeader({ active, kicker, title }: { active: AdminNavKey; kicker: string; title: string }) {
  return (
    <header className="adminHeader">
      <div className="adminBrandBlock">
        <div className="adminBrandLockup" aria-label="通用百货AI创作平台">
          <img alt="" src="/brand-logo.svg" />
          <div>
            <strong>通用百货AI创作平台</strong>
            <span>AI Commerce Visual Studio</span>
          </div>
        </div>
        <div className="adminSectionTitle">
          <span>{kicker}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <AdminNav active={active} />
    </header>
  );
}

async function logoutAdmin() {
  await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/admin/login";
}
