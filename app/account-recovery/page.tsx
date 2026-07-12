"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function AccountRecoveryPage() {
  const [originalPhone, setOriginalPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactCode, setContactCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [description, setDescription] = useState("");
  const [proofs, setProofs] = useState<File[]>([]);
  const [status, setStatus] = useState("请先验证当前可接收短信的手机号");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const previews = useMemo(() => proofs.map((file) => ({ file, url: URL.createObjectURL(file) })), [proofs]);

  function addProofs(files: FileList | null) {
    const selected = Array.from(files ?? []).filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type) && file.size <= 8 * 1024 * 1024);
    setProofs((current) => [...current, ...selected].slice(0, 3));
    setStatus(selected.length ? "证明截图已添加" : "仅支持单张不超过 8MB 的 PNG、JPG、WebP 图片");
  }

  async function sendContactCode() {
    setSending(true);
    const response = await fetch("/api/account-recovery/contact-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: contactPhone }) }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    setSending(false);
    setStatus(response?.ok ? "验证码已发送，输入后完成手机号验证" : recoveryError(body?.error));
  }

  async function verifyContact() {
    setVerifying(true);
    const response = await fetch("/api/account-recovery/contact-code/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: contactPhone, code: contactCode }) }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    setVerifying(false);
    if (!response?.ok) { setStatus(recoveryError(body?.error)); return; }
    setVerificationId(body.verificationId);
    setStatus("当前联系手机号已验证，可以提交人工核验申请");
  }

  async function submit() {
    if (!verificationId || !description.trim()) { setStatus("请先验证手机号，并填写情况说明"); return; }
    setSubmitting(true);
    const data = new FormData();
    data.set("originalPhone", originalPhone);
    data.set("contactPhone", contactPhone);
    data.set("verificationId", verificationId);
    data.set("description", description.trim());
    proofs.forEach((file) => data.append("proofs", file));
    const response = await fetch("/api/account-recovery", { method: "POST", body: data }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    setSubmitting(false);
    if (!response?.ok) { setStatus(recoveryError(body?.error)); return; }
    setStatus("申请已提交。审核通过后，验证码将发送至当前联系手机号。");
    setDescription(""); setProofs([]);
  }

  return (
    <main className="recoveryPage">
      <header className="recoveryHeader"><Link className="recordsBrand" href="/"><img alt="" src="/brand-logo.svg" /><span>通用百货AI创作平台</span></Link><Link href="/reset-password">返回密码重置</Link></header>
      <section className="recoveryCard recoveryApplicationCard">
        <span className="recoveryEyebrow">MANUAL ACCOUNT RECOVERY</span>
        <h1>提交账号找回申请</h1>
        <p>仅用于无法使用原注册手机号的情况。审核通过后，重置验证码会发送到你当前验证过的手机号。</p>
        <label>原注册手机号<input inputMode="tel" maxLength={11} value={originalPhone} onChange={(event) => setOriginalPhone(event.target.value.replace(/\D/g, ""))} placeholder="以前注册平台的手机号" /></label>
        <label>当前可接收短信的手机号<input inputMode="tel" maxLength={11} value={contactPhone} onChange={(event) => { setContactPhone(event.target.value.replace(/\D/g, "")); setVerificationId(""); }} placeholder="审核通过后接收验证码" /></label>
        <div className="recoveryCodeRow"><label>短信验证码<input inputMode="numeric" maxLength={6} value={contactCode} onChange={(event) => setContactCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" /></label><button disabled={sending || contactPhone.length !== 11} type="button" onClick={() => void sendContactCode()}>{sending ? "发送中" : "发送验证码"}</button><button disabled={verifying || contactCode.length !== 6} type="button" onClick={() => void verifyContact()}>{verifying ? "验证中" : verificationId ? "已验证" : "验证"}</button></div>
        <label>情况说明<textarea rows={6} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="请说明无法使用原手机号的原因，并提供可供核验的信息。" /></label>
        <label className="recoveryUpload"><input accept="image/png,image/jpeg,image/webp" multiple type="file" onChange={(event) => { addProofs(event.target.files); event.currentTarget.value = ""; }} /><strong>上传证明截图（可选）</strong><span>最多 3 张，PNG / JPG / WebP，单张不超过 8MB</span></label>
        {previews.length ? <div className="recoveryProofGrid">{previews.map((item, index) => <article key={`${item.file.name}-${index}`}><img alt={item.file.name} src={item.url} /><button type="button" aria-label="删除截图" onClick={() => setProofs((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></article>)}</div> : null}
        <button className="recoveryPrimaryButton" disabled={submitting || originalPhone.length !== 11 || !verificationId || !description.trim()} type="button" onClick={() => void submit()}>{submitting ? "正在提交..." : "提交人工核验申请"}</button>
        <p className="recoveryStatus">{status}</p>
      </section>
    </main>
  );
}

function recoveryError(error: unknown): string {
  if (error === "sms_not_configured") return "短信服务暂未配置，暂时无法验证当前手机号";
  if (error === "sms_send_failed") return "短信发送失败，请稍后再试";
  if (error === "too_many_requests") return "操作过于频繁，请稍后再试";
  if (error === "invalid_code") return "验证码不正确";
  if (error === "code_expired") return "验证码已过期，请重新获取";
  if (error === "verification_required") return "请先完成当前手机号验证";
  if (error === "missing_recovery_description") return "请填写情况说明";
  return "提交失败，请核对信息后重试";
}
