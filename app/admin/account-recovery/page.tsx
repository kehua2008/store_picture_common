"use client";

import { useEffect, useMemo, useState } from "react";
import { redirectToAdminLogin } from "@/client/httpStatus";
import { AdminHeader } from "../AdminNav";

type Application = {
  id: string; originalPhone: string; contactPhone: string; description: string; proofs: Array<{ filename: string; imageUrl: string }>; status: "pending" | "approved" | "rejected" | "completed"; adminNote?: string; createdAt: string; reviewedAt?: string; account?: { id: string; status: string; createdAt: string };
};

export default function AccountRecoveryAdminPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("正在读取账号找回申请...");
  const pending = useMemo(() => applications.filter((item) => item.status === "pending"), [applications]);
  const archived = useMemo(() => applications.filter((item) => item.status !== "pending"), [applications]);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const response = await fetch("/api/admin/account-recovery").catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setStatus(`读取失败：${body?.error ?? "network_error"}`);
      if (response?.status === 401 || response?.status === 403) redirectToAdminLogin();
      return;
    }
    setApplications(body.applications ?? []);
    setStatus("账号找回队列已同步");
  }

  async function review(id: string, action: "approve" | "reject") {
    setStatus(action === "approve" ? "正在发送重置验证码..." : "正在驳回申请...");
    const response = await fetch("/api/admin/account-recovery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, adminNote: notes[id] ?? "" }) }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) { setStatus(`处理失败：${recoveryError(body?.error)}`); return; }
    setApplications((current) => current.map((item) => item.id === id ? body.application : item));
    setStatus(action === "approve" ? "已审核通过，重置验证码已发送到申请中的新手机号" : "申请已驳回，处理备注已保存");
  }

  return (
    <main className="adminShell">
      <AdminHeader active="account-recovery" kicker="Account Recovery Review" title="账号找回审核" />
      <section className="adminStatsGrid feedbackStatsGrid"><article><span>待审核</span><strong>{pending.length}</strong><em>需要人工核验</em></article><article><span>已通过</span><strong>{applications.filter((item) => item.status === "approved").length}</strong><em>已发送重置验证码</em></article><article><span>已完成</span><strong>{applications.filter((item) => item.status === "completed").length}</strong><em>用户已完成重置</em></article><article><span>已驳回</span><strong>{applications.filter((item) => item.status === "rejected").length}</strong><em>核验未通过</em></article></section>
      <RecoveryList title="待审核申请" applications={pending} notes={notes} setNotes={setNotes} review={review} />
      <RecoveryList title="已归档申请" applications={archived} notes={notes} setNotes={setNotes} review={review} />
      <p className="adminStatusLine">{status}</p>
    </main>
  );
}

function RecoveryList({ title, applications, notes, setNotes, review }: { title: string; applications: Application[]; notes: Record<string, string>; setNotes: (update: (current: Record<string, string>) => Record<string, string>) => void; review: (id: string, action: "approve" | "reject") => Promise<void> }) {
  return <section className="adminPanel"><div className="adminPanelHeader"><span>01</span><strong>{title}</strong></div>{!applications.length ? <em className="feedbackEmptyState">暂无申请。</em> : <div className="feedbackReportList">{applications.map((item) => <article className={`feedbackReportCard ${item.status}`} key={item.id}><div className="feedbackReportBody"><header><div><strong>{item.originalPhone} 的账号找回</strong><span>原手机号：{item.originalPhone} · 新手机号：{item.contactPhone} · {formatDate(item.createdAt)}</span></div><b>{statusLabel(item.status)}</b></header><p>{item.description}</p><div className="rechargeOrderMeta"><span>账号：{item.account ? `${item.account.id} · ${item.account.status}` : "未找到原账号"}</span><span>证明：{item.proofs.length} 张</span></div>{item.proofs.length ? <div className="feedbackScreenshotGrid">{item.proofs.map((proof) => <a href={proof.imageUrl} key={proof.imageUrl} rel="noreferrer" target="_blank"><img alt={proof.filename} src={proof.imageUrl} /></a>)}</div> : null}<textarea placeholder="审核备注。驳回时必须说明原因。" rows={3} value={notes[item.id] ?? item.adminNote ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />{item.status === "pending" ? <div className="adminActionRow"><button type="button" onClick={() => void review(item.id, "approve")}>审核通过并发验证码</button><button type="button" onClick={() => void review(item.id, "reject")}>驳回申请</button></div> : null}</div></article>)}</div>}</section>;
}

function statusLabel(status: Application["status"]): string { return status === "approved" ? "已通过" : status === "rejected" ? "已驳回" : status === "completed" ? "已完成" : "待审核"; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function recoveryError(value: unknown): string { if (value === "sms_not_configured") return "短信服务未配置"; if (value === "sms_send_failed") return "验证码发送失败"; if (value === "missing_admin_note") return "驳回时必须填写审核备注"; return typeof value === "string" ? value : "unknown_error"; }
