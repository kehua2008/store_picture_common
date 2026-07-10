"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  creditRechargePlans,
  creditUnitPriceCny,
  detailModuleImageCreditMultiplier,
  detailPosterImageCreditMultiplier,
  estimatePlanBaseImageCount,
  estimatePlanVideoCount,
  unitImagePriceCny,
  type CreditPlanId
} from "../../src/domain/billing/creditPlans";

type PaymentMethod = "wechat" | "alipay";
type RechargeOrderStatus = "pending" | "approved" | "rejected";

type RechargeAccount = {
  customerId: string;
  balanceCredits: number;
  frozenCredits: number;
  updatedAt: string;
};

type CurrentUser = {
  id: string;
  phone: string;
  status: "active" | "suspended";
};

type RechargeOrder = {
  id: string;
  customerId: string;
  planId: CreditPlanId;
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

const paymentMethods: Array<{ id: PaymentMethod; label: string; desc: string }> = [
  { id: "wechat", label: "微信收款码", desc: "扫码付款后上传付款截图" },
  { id: "alipay", label: "支付宝收款码", desc: "扫码付款后上传付款截图" }
];

const customerServiceContacts = [
  { label: "客服 QQ", value: "请配置 QQ 号码" },
  { label: "客服微信", value: "请配置微信号" },
  { label: "客服电话", value: "请配置手机号" }
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: value % 1 ? 1 : 0, maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function priceForCredits(credits: number): string {
  return formatCurrency(credits * creditUnitPriceCny);
}

function detailModuleCredits(baseCredits: number): number {
  return Math.ceil(baseCredits * detailModuleImageCreditMultiplier);
}

function detailPosterCredits(baseCredits: number): number {
  return Math.ceil(baseCredits * detailPosterImageCreditMultiplier);
}

export default function RechargePage() {
  const [selectedPlanId, setSelectedPlanId] = useState<CreditPlanId>("credits-9990");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [paymentProof, setPaymentProof] = useState<{ file: File; name: string; previewUrl: string }>();
  const [orderStatus, setOrderStatus] = useState("选择套餐，扫码付款后上传付款截图");
  const [user, setUser] = useState<CurrentUser>();
  const [account, setAccount] = useState<RechargeAccount>();
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const selectedPlan = useMemo(() => creditRechargePlans.find((plan) => plan.id === selectedPlanId) ?? creditRechargePlans[0], [selectedPlanId]);
  const selectedPayment = paymentMethods.find((item) => item.id === paymentMethod) ?? paymentMethods[0];
  const pendingOrder = useMemo(() => orders.find((order) => order.status === "pending"), [orders]);
  const latestReviewedOrder = useMemo(() => orders.find((order) => order.status !== "pending"), [orders]);

  useEffect(() => {
    void refreshRechargeOrders();
  }, []);

  useEffect(() => {
    if (!pendingOrder) return;
    const timer = window.setInterval(() => void refreshRechargeOrders(), 5000);
    return () => window.clearInterval(timer);
  }, [pendingOrder?.id]);

  useEffect(() => {
    if (pendingOrder) {
      setOrderStatus(`${pendingOrder.planLabel} · ${formatCurrency(pendingOrder.priceCny)} 已提交，等待管理员审核`);
      return;
    }
    if (latestReviewedOrder?.status === "approved") {
      setOrderStatus(`${latestReviewedOrder.planLabel} 已审核通过，${formatNumber(latestReviewedOrder.credits)} 算力点已到账`);
      return;
    }
    if (latestReviewedOrder?.status === "rejected") {
      setOrderStatus(`充值申请未通过：${latestReviewedOrder.rejectReason ?? "请联系客服补充付款信息"}`);
      return;
    }
    setOrderStatus("选择套餐，扫码付款后上传付款截图");
  }, [pendingOrder, latestReviewedOrder]);

  useEffect(() => {
    return () => {
      if (paymentProof) URL.revokeObjectURL(paymentProof.previewUrl);
    };
  }, [paymentProof]);

  async function refreshRechargeOrders() {
    const meResponse = await fetch("/api/auth/me").catch(() => undefined);
    const meBody = await meResponse?.json().catch(() => ({}));
    if (!meResponse?.ok) {
      setUser(undefined);
      setOrders([]);
      setAccount(undefined);
      setOrderStatus("请先登录账号，再提交充值申请");
      return;
    }
    setUser(meBody.user);
    setAccount(meBody.account);

    const response = await fetch("/api/recharge-orders");
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setOrders([]);
      setOrderStatus(`充值记录加载失败：${body.error ?? "请稍后重试"}`);
      return;
    }
    setOrders(body.orders ?? []);
    setAccount(body.accounts?.[0] ?? meBody.account);
  }

  function uploadPaymentProof(files: FileList | null) {
    if (pendingOrder) return;
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPaymentProof((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, name: file.name, previewUrl: URL.createObjectURL(file) };
    });
    setOrderStatus("付款截图已上传，请提交给后台确认");
  }

  async function submitManualRechargeOrder() {
    if (pendingOrder || submitting) return;
    if (!paymentProof) {
      setOrderStatus("请先上传付款截图，后台才能确认到账");
      return;
    }
    const formData = new FormData();
    formData.append("planId", selectedPlan.id);
    formData.append("paymentMethod", paymentMethod);
    formData.append("proof", paymentProof.file, paymentProof.file.name);
    setSubmitting(true);
    setOrderStatus("正在提交付款截图...");
    const response = await fetch("/api/recharge-orders", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setOrderStatus(`提交失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setOrders((current) => [body.order, ...current]);
    setAccount(body.account);
    setPaymentProof((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return undefined;
    });
  }

  return (
    <main className="rechargePage">
      <header className="rechargeHeader">
        <Link className="rechargeLogo" href="/">
          <img alt="" src="/brand-logo.svg" />
          <strong>通用百货AI创作平台</strong>
        </Link>
        <div className="billingHeaderActions">
          <Link className="rechargeBackLink" href="/pricing">查看资费规则</Link>
          <Link className="rechargeBackLink" href="/">返回生图工作台</Link>
        </div>
      </header>

      <section className="rechargeShell">
        <div className="creditHero">
          <div>
            <span className="eyebrow">算力点账户</span>
            <h1>按生成量充值，用多少扣多少</h1>
            <p>{user ? `当前账号：${user.phone}` : "请先登录账号，充值申请会自动绑定当前账号。"} 1 算力点按 0.10 元折算，充值档位越高，单张图片和单条视频扣点越低。</p>
          </div>
          <aside className="balanceCard" aria-label="账户余额">
            <span>当前余额</span>
            <strong>{formatNumber(account?.balanceCredits ?? 0)}</strong>
            <em>算力点</em>
          </aside>
        </div>

        <div className="rechargeContent">
          <section className="planSection" aria-label="充值套餐">
            <div className="sectionHeading">
              <span className="eyebrow">充值规格</span>
              <h2>99 元起充，套餐越高单张成本越低</h2>
            </div>
            <div className="rechargePriceGuide" aria-label="充值档位单次价格参考">
              <article>
                <span>当前选中档位</span>
                <strong>{selectedPlan.customerType}</strong>
                <em>{formatCurrency(selectedPlan.priceCny)} · {formatNumber(selectedPlan.credits)} 点</em>
              </article>
              <article>
                <span>基础图片</span>
                <strong>{priceForCredits(selectedPlan.imageCreditsPerUnit)} / 张</strong>
                <em>主图、白底图、场景图</em>
              </article>
              <article>
                <span>详情图片</span>
                <strong>{priceForCredits(detailModuleCredits(selectedPlan.imageCreditsPerUnit))} - {priceForCredits(detailPosterCredits(selectedPlan.imageCreditsPerUnit))} / 张</strong>
                <em>模块图、首屏海报</em>
              </article>
              <article>
                <span>短视频</span>
                <strong>{priceForCredits(selectedPlan.videoCreditsPerUnit)} / 条</strong>
                <em>复杂参考素材另计</em>
              </article>
            </div>
            <div className="creditPlanGrid">
              {creditRechargePlans.map((plan) => {
                const active = plan.id === selectedPlan.id;
                return (
                  <button disabled={Boolean(pendingOrder)} className={active ? "creditPlanCard active" : "creditPlanCard"} key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)}>
                    <span className="planTop">
                      <strong>{plan.label}</strong>
                      {plan.badge ? <em>{plan.badge}</em> : null}
                    </span>
                    <span className="planPrice">{formatCurrency(plan.priceCny)}</span>
                    <span className="planDesc">{plan.description}</span>
                    <span className="planMeta">
                      <i>{plan.customerType} · 基础图 {plan.imageCreditsPerUnit} 点/张</i>
                      <i>基础图约 {formatCurrency(unitImagePriceCny(plan))} / 张</i>
                      <i>详情图约 {priceForCredits(detailModuleCredits(plan.imageCreditsPerUnit))} - {priceForCredits(detailPosterCredits(plan.imageCreditsPerUnit))} / 张</i>
                      <i>视频约 {priceForCredits(plan.videoCreditsPerUnit)} / 条</i>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="checkoutPanel" aria-label="订单摘要">
            <div className="sectionHeading">
              <span className="eyebrow">订单确认</span>
              <h2>充值摘要</h2>
            </div>
            <div className="summaryRows">
              <span>套餐</span><strong>{selectedPlan.label}</strong>
              <span>到账算力点</span><strong>{formatNumber(selectedPlan.credits)} 点</strong>
              <span>预计基础图</span><strong>{formatNumber(estimatePlanBaseImageCount(selectedPlan))} 张</strong>
              <span>预计视频</span><strong>{formatNumber(estimatePlanVideoCount(selectedPlan))} 条</strong>
              <span>基础图单价</span><strong>{priceForCredits(selectedPlan.imageCreditsPerUnit)} / 张</strong>
              <span>视频单价</span><strong>{priceForCredits(selectedPlan.videoCreditsPerUnit)} / 条</strong>
              <span>订单金额</span><strong>{formatCurrency(selectedPlan.priceCny)}</strong>
            </div>

            <div className="paymentMethodGrid">
              {paymentMethods.map((method) => (
                <button disabled={Boolean(pendingOrder)} className={method.id === paymentMethod ? "paymentMethod active" : "paymentMethod"} key={method.id} type="button" onClick={() => setPaymentMethod(method.id)}>
                  <strong>{method.label}</strong>
                  <span>{method.desc}</span>
                </button>
              ))}
            </div>

            <div className="qrPaymentPanel" aria-label={`${selectedPayment.label}付款码`}>
              <div className={`qrPlaceholder ${paymentMethod}`}>
                <span>{paymentMethod === "wechat" ? "微信" : "支付宝"}</span>
                <strong>收款码</strong>
                <em>待替换真实二维码</em>
              </div>
              <div>
                <strong>{selectedPayment.label}</strong>
                <span>请按订单金额 {formatCurrency(selectedPlan.priceCny)} 扫码付款。付款完成后上传付款截图，后台确认后到账 {formatNumber(selectedPlan.credits)} 算力点。</span>
              </div>
            </div>

            <label className="paymentProofUpload">
              <input accept="image/png,image/jpeg,image/webp" disabled={Boolean(pendingOrder)} onChange={(event) => uploadPaymentProof(event.target.files)} type="file" />
              {paymentProof ? (
                <>
                  <img alt={paymentProof.name} src={paymentProof.previewUrl} />
                  <span>
                    <strong>付款截图已选择</strong>
                    <em>{paymentProof.name}</em>
                  </span>
                </>
              ) : (
                <span>
                  <strong>上传付款截图</strong>
                  <em>支持 JPG / PNG / WebP，后台确认后充值点数到账</em>
                </span>
              )}
            </label>

            <div className="rechargeNotice">
              <strong>人工确认到账</strong>
              <span>当前未接入在线支付接口。扫码付款并上传截图后，由后台核验；确认后相应算力点到账，算力点 12 个月有效。</span>
            </div>
            <button className={pendingOrder ? "rechargeButton submitted" : "rechargeButton"} disabled={Boolean(pendingOrder) || submitting} type="button" onClick={submitManualRechargeOrder}>
              {pendingOrder ? "已提交，等待审核" : submitting ? "提交中..." : "提交付款截图"}
            </button>
            <p className="orderStatus">{orderStatus}</p>
            {latestReviewedOrder?.status === "rejected" ? (
              <div className="rechargeRejectNotice">
                <strong>驳回通知</strong>
                <span>{latestReviewedOrder.rejectReason}</span>
              </div>
            ) : null}
          </aside>
        </div>

        <section className="supportContactPanel" aria-label="联系客服">
          <div className="sectionHeading">
            <span className="eyebrow">联系客服</span>
            <h2>付款后如需尽快确认到账，可主动联系人工客服</h2>
          </div>
          <div className="supportContactGrid">
            {customerServiceContacts.map((contact) => (
              <article key={contact.label}>
                <span>{contact.label}</span>
                <strong>{contact.value}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
