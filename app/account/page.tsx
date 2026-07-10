"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  phone: string;
  displayName?: string;
  companyName?: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
};

type CreditAccount = {
  customerId: string;
  balanceCredits: number;
  frozenCredits: number;
  updatedAt?: string;
};

type CurrentActor = {
  actorId: string;
  actorName: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<CurrentUser>();
  const [actor, setActor] = useState<CurrentActor>();
  const [account, setAccount] = useState<CreditAccount>();
  const [status, setStatus] = useState("正在同步账号资料...");

  useEffect(() => {
    void refreshAccount();
  }, []);

  async function refreshAccount() {
    const response = await fetch("/api/auth/me").catch(() => undefined);
    if (!response?.ok) {
      setUser(undefined);
      setActor(undefined);
      setAccount(undefined);
      setStatus("请先登录后查看账号资料");
      return;
    }

    const body = await response.json().catch(() => ({}));
    setUser(body.user);
    setActor(body.actor);
    setAccount(body.account);
    setStatus("账号资料已同步");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(undefined);
    setActor(undefined);
    setAccount(undefined);
    setStatus("已退出登录");
  }

  if (!user) {
    return (
      <main className="accountPage">
        <header className="recordsHeader">
          <Link className="recordsBrand" href="/">
            <img alt="" src="/brand-logo.svg" />
            <span>通用百货AI创作平台</span>
          </Link>
          <Link className="recordsBack" href="/">返回首页登录</Link>
        </header>
        <section className="recordsLoginPrompt">
          <strong>请先登录</strong>
          <span>{status}</span>
          <Link href="/">返回首页登录</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="accountPage">
      <header className="recordsHeader">
        <Link className="recordsBrand" href="/">
          <img alt="" src="/brand-logo.svg" />
          <span>通用百货AI创作平台</span>
        </Link>
        <nav>
          <Link href="/">工作台</Link>
          <Link href="/generation-records">生成记录</Link>
          <Link href="/recharge">算力点充值</Link>
        </nav>
      </header>

      <section className="accountHero">
        <div>
          <span>Account Profile</span>
          <h1>账号资料</h1>
          <p>账号资料用于生成记录归属、积分冻结结算和本地多人使用体验。</p>
        </div>
        <aside>
          <p><span>可用积分</span><strong>{formatNumber(account?.balanceCredits ?? 0)}</strong></p>
          <p><span>冻结积分</span><strong>{formatNumber(account?.frozenCredits ?? 0)}</strong></p>
          <p><span>状态</span><strong>{user.status === "active" ? "启用" : "停用"}</strong></p>
        </aside>
      </section>

      <section className="accountNotice">
        <strong>{status}</strong>
        <span>用户 ID 由系统在注册时生成，作为账号和积分账户的唯一关联键。</span>
      </section>

      <section className="accountWorkspace">
        <div className="accountInfoPanel">
          <header>
            <span>Profile</span>
            <h2>基础资料</h2>
          </header>
          <div className="accountRows">
            <p><span>手机号</span><strong>{user.phone}</strong></p>
            <p><span>当前使用者</span><strong>{actor?.actorName ?? "默认同事"}</strong></p>
            <p><span>使用者 ID</span><strong>{actor?.actorId ?? "-"}</strong></p>
            <p><span>账号状态</span><strong>{user.status === "active" ? "启用" : "停用"}</strong></p>
            <p><span>用户 ID</span><strong>{user.id}</strong></p>
            <p><span>创建时间</span><strong>{formatDateTime(user.createdAt)}</strong></p>
            <p><span>更新时间</span><strong>{formatDateTime(user.updatedAt)}</strong></p>
          </div>
        </div>

        <aside className="accountInfoPanel">
          <header>
            <span>Billing</span>
            <h2>积分账户</h2>
          </header>
          <div className="accountRows">
            <p><span>客户 ID</span><strong>{account?.customerId ?? user.id}</strong></p>
            <p><span>可用积分</span><strong>{formatNumber(account?.balanceCredits ?? 0)}</strong></p>
            <p><span>冻结积分</span><strong>{formatNumber(account?.frozenCredits ?? 0)}</strong></p>
            <p><span>账户更新</span><strong>{formatDateTime(account?.updatedAt)}</strong></p>
          </div>
          <div className="accountActions">
            <Link href="/recharge">充值算力点</Link>
            <Link className="feedbackAccountAction" href="/feedback">网站报错和建议</Link>
            <button type="button" onClick={() => void logout()}>退出登录</button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}
