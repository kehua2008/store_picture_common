"use client";

import Link from "next/link";
import { useState } from "react";

type ResetMode = "automatic" | "manual";

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<ResetMode>("automatic");
  const [phone, setPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("输入手机号后获取验证码");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode() {
    if (mode !== "automatic") return;
    setSending(true);
    const response = await fetch("/api/auth/password-reset/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    setSending(false);
    if (!response?.ok) {
      setStatus(resetError(body?.error));
      return;
    }
    setStatus("如该手机号已注册，验证码将发送至该手机号。60 秒后可重新获取。");
  }

  async function submit() {
    if (password !== confirmPassword) {
      setStatus("两次输入的新密码不一致");
      return;
    }
    setSubmitting(true);
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, contactPhone: mode === "manual" ? contactPhone : undefined, manual: mode === "manual", code, password })
    }).catch(() => undefined);
    const body = await response?.json().catch(() => ({}));
    setSubmitting(false);
    if (!response?.ok) {
      setStatus(resetError(body?.error));
      return;
    }
    setStatus("密码已重置，正在返回创作平台...");
    window.setTimeout(() => { window.location.href = "/"; }, 700);
  }

  return (
    <main className="recoveryPage">
      <header className="recoveryHeader">
        <Link className="recordsBrand" href="/"><img alt="" src="/brand-logo.svg" /><span>通用百货AI创作平台</span></Link>
        <Link href="/">返回创作平台</Link>
      </header>
      <section className="recoveryCard">
        <span className="recoveryEyebrow">ACCOUNT SECURITY</span>
        <h1>重置登录密码</h1>
        <p>验证码验证成功后，旧设备的登录状态会自动失效。</p>
        <div className="recoveryModeSwitch">
          <button className={mode === "automatic" ? "active" : ""} type="button" onClick={() => { setMode("automatic"); setStatus("输入手机号后获取验证码"); }}>手机号验证</button>
          <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => { setMode("manual"); setStatus("请输入人工审核通过后收到的验证码"); }}>人工审核后重置</button>
        </div>
        <label>原注册手机号<input inputMode="tel" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="11 位手机号" /></label>
        {mode === "manual" ? <label>审核时填写的新手机号<input inputMode="tel" maxLength={11} value={contactPhone} onChange={(event) => setContactPhone(event.target.value.replace(/\D/g, ""))} placeholder="接收人工审核验证码的手机号" /></label> : null}
        <div className="recoveryCodeRow">
          <label>验证码<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" /></label>
          {mode === "automatic" ? <button type="button" disabled={sending || phone.length !== 11} onClick={() => void sendCode()}>{sending ? "发送中" : "获取验证码"}</button> : null}
        </div>
        <label>新密码<input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8-72 位" /></label>
        <label>确认新密码<input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" /></label>
        <button className="recoveryPrimaryButton" disabled={submitting || phone.length !== 11 || code.length !== 6 || password.length < 8 || (mode === "manual" && contactPhone.length !== 11)} type="button" onClick={() => void submit()}>{submitting ? "正在重置..." : "确认重置并登录"}</button>
        <p className="recoveryStatus">{status}</p>
        {mode === "automatic" ? <p className="recoveryHelp">无法使用原手机号？<Link href="/account-recovery">提交人工账号找回申请</Link></p> : <p className="recoveryHelp">尚未通过人工审核？<Link href="/account-recovery">提交账号找回申请</Link></p>}
      </section>
    </main>
  );
}

function resetError(error: unknown): string {
  if (error === "sms_not_configured") return "短信服务暂未配置，请提交人工账号找回申请";
  if (error === "sms_send_failed") return "短信发送失败，请稍后重试或提交人工申请";
  if (error === "too_many_requests") return "操作过于频繁，请稍后再试";
  if (error === "code_expired") return "验证码已过期，请重新获取";
  if (error === "too_many_attempts") return "验证码尝试次数过多，请重新获取";
  if (error === "invalid_code") return "验证码不正确";
  if (error === "invalid_password") return "密码应为 8-72 位";
  return "重置失败，请核对信息后重试";
}
