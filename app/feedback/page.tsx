"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CurrentUser = {
  id: string;
  phone: string;
  status: "active" | "suspended";
};

type FeedbackReport = {
  id: string;
  title: string;
  description: string;
  contact?: string;
  screenshots: Array<{ filename: string; imageUrl: string }>;
  status: "pending" | "valid" | "invalid" | "resolved";
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
};

const maxScreenshots = 3;

export default function FeedbackPage() {
  const [user, setUser] = useState<CurrentUser>();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [status, setStatus] = useState("正在检查登录状态...");
  const [submitting, setSubmitting] = useState(false);
  const previews = useMemo(() => screenshots.map((file) => ({ file, url: URL.createObjectURL(file) })), [screenshots]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  async function refresh() {
    const me = await fetch("/api/auth/me").catch(() => undefined);
    if (!me?.ok) {
      setUser(undefined);
      setReports([]);
      setStatus("请先登录后提交网站报错和建议");
      return;
    }
    const meBody = await me.json().catch(() => ({}));
    setUser(meBody.user);
    const feedback = await fetch("/api/feedback-reports").catch(() => undefined);
    if (feedback?.ok) {
      const body = await feedback.json().catch(() => ({}));
      setReports(body.reports ?? []);
    }
    setStatus("可以提交你遇到的问题、报错截图或改进建议");
  }

  function addScreenshots(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    const imageFiles = nextFiles.filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type));
    const merged = [...screenshots, ...imageFiles].slice(0, maxScreenshots);
    setScreenshots(merged);
    if (nextFiles.length !== imageFiles.length) setStatus("仅支持 PNG、JPG、WebP 截图");
    else if (screenshots.length + imageFiles.length > maxScreenshots) setStatus("最多上传 3 张截图，已自动保留前 3 张");
    else setStatus("截图已添加");
  }

  async function submitFeedback() {
    if (!user) {
      setStatus("请先登录后提交");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setStatus("请填写问题标题和详细描述");
      return;
    }
    const oversized = screenshots.find((file) => file.size > 8 * 1024 * 1024);
    if (oversized) {
      setStatus("单张截图不能超过 8MB");
      return;
    }

    setSubmitting(true);
    setStatus("正在提交反馈...");
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("description", description.trim());
    if (contact.trim()) formData.set("contact", contact.trim());
    screenshots.forEach((file) => formData.append("screenshots", file));

    const response = await fetch("/api/feedback-reports", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setStatus(`提交失败：${feedbackErrorLabel(body.error)}`);
      return;
    }

    setReports((current) => [body.report, ...current]);
    setTitle("");
    setDescription("");
    setContact("");
    setScreenshots([]);
    setStatus("已提交，我们会尽快查看");
  }

  if (!user) {
    return (
      <main className="accountPage feedbackPage">
        <FeedbackHeader />
        <section className="recordsLoginPrompt">
          <strong>请先登录</strong>
          <span>{status}</span>
          <Link href="/">返回首页登录</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="accountPage feedbackPage">
      <FeedbackHeader />

      <section className="feedbackHero">
        <span>Feedback Inbox</span>
        <h1>网站报错和建议</h1>
        <p>遇到报错、功能异常、生成结果问题，或者有改进建议，都可以在这里提交。截图越清楚，我们越容易定位。</p>
      </section>

      <section className="feedbackLayout">
        <div className="feedbackFormPanel">
          <label>
            问题标题
            <input value={title} maxLength={80} placeholder="例如：视频生成后无法下载" onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            详细描述
            <textarea value={description} rows={8} maxLength={5000} placeholder="请描述你在哪里遇到问题、点击了什么、页面显示了什么报错。" onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            联系方式或补充说明（可选）
            <input value={contact} maxLength={120} placeholder="例如：微信、电话、希望回复的方式" onChange={(event) => setContact(event.target.value)} />
          </label>
          <label className="feedbackUploadBox">
            <input accept="image/png,image/jpeg,image/webp" multiple type="file" onChange={(event) => { addScreenshots(event.target.files); event.currentTarget.value = ""; }} />
            <strong>上传截图</strong>
            <span>最多 3 张，支持 PNG / JPG / WebP，单张不超过 8MB</span>
          </label>
          {previews.length ? (
            <div className="feedbackPreviewGrid">
              {previews.map((preview, index) => (
                <article key={`${preview.file.name}-${index}`}>
                  <img alt={preview.file.name} src={preview.url} />
                  <button type="button" aria-label="删除截图" onClick={() => setScreenshots((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                </article>
              ))}
            </div>
          ) : null}
          <button className="feedbackSubmitButton" disabled={submitting} type="button" onClick={() => void submitFeedback()}>
            {submitting ? "正在提交..." : "提交网站报错和建议"}
          </button>
          <p className="feedbackStatusLine">{status}</p>
        </div>

        <aside className="feedbackHistoryPanel">
          <header>
            <span>你的反馈记录</span>
            <strong>{reports.length} 条</strong>
          </header>
          <div className="feedbackHistoryList">
            {reports.map((report) => (
              <article key={report.id} className={report.status}>
                <strong>{report.title}</strong>
                <span>{feedbackStatusLabel(report.status)} · {formatDate(report.createdAt)}</span>
                <p>{report.description}</p>
                {report.adminNote ? <em>处理备注：{report.adminNote}</em> : null}
              </article>
            ))}
            {!reports.length ? <em>暂无反馈记录。</em> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function FeedbackHeader() {
  return (
    <header className="recordsHeader">
      <Link className="recordsBrand" href="/">
        <img alt="" src="/brand-logo.svg" />
        <span>通用百货AI创作平台</span>
      </Link>
      <nav>
        <Link href="/">工作台</Link>
        <Link href="/account">账号资料</Link>
      </nav>
    </header>
  );
}

function feedbackStatusLabel(status: FeedbackReport["status"]): string {
  if (status === "valid") return "有效问题";
  if (status === "invalid") return "无效反馈";
  if (status === "resolved") return "已处理";
  return "待审核";
}

function feedbackErrorLabel(error: unknown): string {
  if (error === "feedback_screenshot_too_large") return "单张截图不能超过 8MB";
  if (error === "too_many_feedback_screenshots") return "最多上传 3 张截图";
  if (error === "invalid_feedback_screenshot_type") return "截图格式仅支持 PNG、JPG、WebP";
  if (error === "missing_feedback_description") return "请填写详细描述";
  if (error === "missing_feedback_title") return "请填写问题标题";
  return typeof error === "string" ? error : "unknown_error";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
