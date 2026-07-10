"use client";

import { useEffect, useMemo, useState } from "react";
import { describeNetworkFailure, describeRequestFailure, readJsonRecord, redirectToAdminLogin } from "@/client/httpStatus";
import { AdminHeader } from "../AdminNav";

type Member = {
  user: {
    id: string;
    phone: string;
    displayName?: string;
    companyName?: string;
    status: "active" | "suspended";
    createdAt: string;
  };
  account: {
    balanceCredits: number;
    frozenCredits: number;
  };
  totalRechargeCredits: number;
  totalConsumedCredits: number;
  rechargeOrderCount: number;
  taskCount: number;
  outputCount: number;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [adjustCredits, setAdjustCredits] = useState("100");
  const [adjustReason, setAdjustReason] = useState("");
  const [status, setStatus] = useState("客户资料与积分账户");
  const [loadError, setLoadError] = useState("");
  const selectedMember = useMemo(() => members.find((member) => member.user.id === selectedMemberId) ?? members[0], [members, selectedMemberId]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/members");
      const body = await readJsonRecord(response);
      if (!response.ok) {
        const message = describeRequestFailure("会员列表读取失败", response, body);
        setMembers([]);
        setLoadError(message);
        setStatus(message);
        if (response.status === 401 || response.status === 403) redirectToAdminLogin();
        return;
      }
      setMembers(Array.isArray(body.members) ? body.members as Member[] : []);
      setLoadError("");
    } catch (error) {
      const message = describeNetworkFailure("会员列表读取失败", error);
      setMembers([]);
      setLoadError(message);
      setStatus(message);
    }
  }

  async function updateMember(action: "activate" | "suspend") {
    if (!selectedMember) return;
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedMember.user.id, action })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`操作失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(action === "activate" ? "账号已恢复" : "账号已停用");
    await refresh();
  }

  async function submitAdjustment() {
    if (!selectedMember) return;
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedMember.user.id,
        action: "adjust",
        deltaCredits: Number(adjustCredits),
        reason: adjustReason
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`调账失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(`调账完成，余额 ${formatNumber(body.account.balanceCredits)} 点`);
    setAdjustReason("");
    await refresh();
  }

  return (
    <main className="adminShell">
      <AdminHeader active="members" kicker="Admin Members" title="客户管理" />

      <section className="adminStatsGrid">
        <article><span>注册会员</span><strong>{members.length}</strong><em>全部账号</em></article>
        <article><span>总余额</span><strong>{formatNumber(members.reduce((sum, item) => sum + item.account.balanceCredits, 0))}</strong><em>可用积分</em></article>
        <article><span>总冻结</span><strong>{formatNumber(members.reduce((sum, item) => sum + item.account.frozenCredits, 0))}</strong><em>任务占用</em></article>
      </section>

      <section className="adminWorkflowGrid">
        <div className="adminPanel">
          <div className="adminPanelHeader"><span>01</span><strong>会员列表</strong></div>
          <div className="memberTable">
            {members.map((member) => (
              <button className={member.user.id === selectedMember?.user.id ? "active" : ""} key={member.user.id} type="button" onClick={() => setSelectedMemberId(member.user.id)}>
                <strong>{member.user.displayName || member.user.phone}</strong>
                <span>{member.user.phone}</span>
                <span>{member.user.status === "active" ? "启用" : "停用"}</span>
                <span>{formatNumber(member.account.balanceCredits)} / 冻结 {formatNumber(member.account.frozenCredits)}</span>
                <span>充值 {formatNumber(member.totalRechargeCredits)} · 消耗 {formatNumber(member.totalConsumedCredits)}</span>
              </button>
            ))}
            {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
            {!loadError && !members.length ? <em>暂无注册会员。</em> : null}
          </div>
        </div>

        <div className="adminPanel">
          <div className="adminPanelHeader"><span>02</span><strong>会员详情与调账</strong></div>
          {selectedMember ? (
            <>
              <div className="memberDetailGrid">
                <article><span>手机号</span><strong>{selectedMember.user.phone}</strong></article>
                <article><span>账号状态</span><strong>{selectedMember.user.status === "active" ? "启用" : "停用"}</strong></article>
                <article><span>注册时间</span><strong>{formatDate(selectedMember.user.createdAt)}</strong></article>
                <article><span>任务 / 出图</span><strong>{selectedMember.taskCount} / {selectedMember.outputCount}</strong></article>
                <article><span>充值订单</span><strong>{selectedMember.rechargeOrderCount}</strong></article>
                <article><span>累计消耗</span><strong>{formatNumber(selectedMember.totalConsumedCredits)}</strong></article>
              </div>
              <div className="adminActionRow">
                <button type="button" onClick={() => void updateMember(selectedMember.user.status === "active" ? "suspend" : "activate")}>
                  {selectedMember.user.status === "active" ? "停用账号" : "恢复账号"}
                </button>
              </div>
              <div className="adminFormGrid">
                <label>调账积分<input value={adjustCredits} onChange={(event) => setAdjustCredits(event.target.value)} /></label>
                <label>调账原因<input placeholder="必须填写，写入财务流水" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} /></label>
              </div>
              <div className="adminActionRow">
                <button type="button" onClick={() => void submitAdjustment()}>提交人工调账</button>
              </div>
            </>
          ) : <em className="adminStatusLine">请选择会员。</em>}
          <p className="adminStatusLine">{status}</p>
        </div>
      </section>
    </main>
  );
}
