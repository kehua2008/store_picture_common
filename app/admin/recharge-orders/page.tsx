"use client";

import { useEffect, useMemo, useState } from "react";
import { describeNetworkFailure, describeRequestFailure, readJsonRecord, redirectToAdminLogin } from "@/client/httpStatus";
import { AdminHeader } from "../AdminNav";

type RechargeOrderStatus = "pending" | "approved" | "rejected";
type PaymentMethod = "wechat" | "alipay";

type RechargeAccount = {
  customerId: string;
  balanceCredits: number;
  frozenCredits: number;
  updatedAt: string;
};

type RechargeOrder = {
  id: string;
  customerId: string;
  planLabel: string;
  credits: number;
  priceCny: number;
  paymentMethod: PaymentMethod;
  proofFilename: string;
  proofImageUrl: string;
  status: RechargeOrderStatus;
  rejectReason?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function RechargeOrdersAdminPage() {
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [accounts, setAccounts] = useState<RechargeAccount[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("等待审核充值申请");
  const [loadError, setLoadError] = useState("");
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending"), [orders]);
  const reviewedOrders = useMemo(() => orders.filter((order) => order.status !== "pending"), [orders]);
  const totalPendingAmount = pendingOrders.reduce((sum, order) => sum + order.priceCny, 0);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/recharge-orders");
      const body = await readJsonRecord(response);
      if (!response.ok) {
        const message = describeRequestFailure("充值订单读取失败", response, body);
        setOrders([]);
        setAccounts([]);
        setLoadError(message);
        setStatus(message);
        if (response.status === 401 || response.status === 403) redirectToAdminLogin();
        return;
      }
      setOrders(Array.isArray(body.orders) ? body.orders as RechargeOrder[] : []);
      setAccounts(Array.isArray(body.accounts) ? body.accounts as RechargeAccount[] : []);
      setLoadError("");
    } catch (error) {
      const message = describeNetworkFailure("充值订单读取失败", error);
      setOrders([]);
      setAccounts([]);
      setLoadError(message);
      setStatus(message);
    }
  }

  async function reviewOrder(id: string, nextStatus: "approved" | "rejected") {
    const rejectReason = rejectReasons[id]?.trim();
    if (nextStatus === "rejected" && !rejectReason) {
      setStatus("驳回前请填写驳回理由，用户会在充值页看到这条通知");
      return;
    }

    setStatus(nextStatus === "approved" ? "正在确认到账..." : "正在提交驳回通知...");
    const response = await fetch("/api/admin/recharge-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus, rejectReason })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`审核失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(nextStatus === "approved" ? `已通过，账户余额更新为 ${formatNumber(body.account.balanceCredits)} 点` : "已驳回，理由已通知用户");
    setOrders((current) => current.map((order) => order.id === id ? body.order : order));
    setAccounts((current) => {
      const next = body.account as RechargeAccount;
      return [next, ...current.filter((account) => account.customerId !== next.customerId)];
    });
  }

  return (
    <main className="adminShell">
      <AdminHeader active="recharge" kicker="Admin Billing Desk" title="充值审核后台" />

      <section className="adminStatsGrid">
        <article>
          <span>待审核</span>
          <strong>{pendingOrders.length}</strong>
          <em>笔充值申请</em>
        </article>
        <article>
          <span>待核验金额</span>
          <strong>{formatCurrency(totalPendingAmount)}</strong>
          <em>人工收款</em>
        </article>
        <article>
          <span>账户数</span>
          <strong>{accounts.length}</strong>
          <em>有充值记录用户</em>
        </article>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>01</span>
          <strong>待审核充值</strong>
        </div>
        <div className="adminExplainBox">
          <strong>审核规则</strong>
          <span>核对金额、付款方式和截图；通过后立即给用户账户加算力点，驳回时必须填写理由并显示到用户充值页。</span>
        </div>
        <div className="rechargeOrderList">
          {pendingOrders.map((order) => (
            <article className="rechargeOrderCard pending" key={order.id}>
              <a href={order.proofImageUrl} target="_blank" rel="noreferrer">
                <img alt={order.proofFilename} src={order.proofImageUrl} />
              </a>
              <div className="rechargeOrderBody">
                <header>
                  <div>
                    <strong>{order.planLabel}</strong>
                    <span>{order.customerId} · {paymentMethodLabel(order.paymentMethod)} · {formatDate(order.createdAt)}</span>
                  </div>
                  <b>{formatCurrency(order.priceCny)}</b>
                </header>
                <div className="rechargeOrderMeta">
                  <span>到账 {formatNumber(order.credits)} 点</span>
                  <span>状态：待审核</span>
                  <span>截图：{order.proofFilename}</span>
                </div>
                <textarea
                  placeholder="未通过时填写驳回理由，例如：付款金额与套餐不一致 / 截图不清晰 / 未查询到对应流水"
                  rows={3}
                  value={rejectReasons[order.id] ?? ""}
                  onChange={(event) => setRejectReasons((current) => ({ ...current, [order.id]: event.target.value }))}
                />
                <div className="adminActionRow">
                  <button type="button" onClick={() => void reviewOrder(order.id, "approved")}>通过并到账</button>
                  <button type="button" onClick={() => void reviewOrder(order.id, "rejected")}>驳回并通知</button>
                </div>
              </div>
            </article>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !pendingOrders.length ? <em>暂无待审核充值申请。</em> : null}
        </div>
        <p className="adminStatusLine">{status}</p>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>02</span>
          <strong>已审核记录</strong>
        </div>
        <div className="rechargeHistoryTable">
          {reviewedOrders.map((order) => (
            <article key={order.id} className={order.status}>
              <strong>{order.planLabel}</strong>
              <span>{order.customerId}</span>
              <span>{formatCurrency(order.priceCny)} / {formatNumber(order.credits)} 点</span>
              <span>{order.status === "approved" ? "已通过" : `已驳回：${order.rejectReason}`}</span>
              <time>{formatDate(order.reviewedAt ?? order.updatedAt)}</time>
            </article>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !reviewedOrders.length ? <em>暂无已审核记录。</em> : null}
        </div>
      </section>
    </main>
  );
}

function paymentMethodLabel(method: PaymentMethod): string {
  return method === "alipay" ? "支付宝" : "微信";
}
