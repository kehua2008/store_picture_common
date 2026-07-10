"use client";

import { useEffect, useMemo, useState } from "react";
import { redirectToAdminLogin } from "@/client/httpStatus";
import { AdminHeader } from "../AdminNav";

type FeedbackStatus = "pending" | "valid" | "invalid" | "resolved";

type FeedbackReport = {
  id: string;
  customerId: string;
  customerPhone: string;
  actorName?: string;
  title: string;
  description: string;
  contact?: string;
  screenshots: Array<{ filename: string; imageUrl: string }>;
  status: FeedbackStatus;
  adminNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export default function FeedbackReportsAdminPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("等待反馈提交");
  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);
  const validReports = useMemo(() => reports.filter((report) => report.status === "valid"), [reports]);
  const resolvedReports = useMemo(() => reports.filter((report) => report.status === "resolved"), [reports]);
  const invalidReports = useMemo(() => reports.filter((report) => report.status === "invalid"), [reports]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const response = await fetch("/api/feedback-reports");
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`读取失败：${body.error ?? "unknown_error"}`);
      if (response.status === 401 || response.status === 403) redirectToAdminLogin();
      return;
    }
    setReports(body.reports ?? []);
    setStatus("反馈收件箱已同步");
  }

  async function reviewReport(id: string, nextStatus: FeedbackStatus) {
    setStatus("正在更新反馈状态...");
    const response = await fetch("/api/feedback-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus, adminNote: notes[id] ?? "" })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`更新失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setReports((current) => current.map((report) => report.id === id ? body.report : report));
    setStatus(`已标记为：${feedbackStatusLabel(nextStatus)}`);
  }

  return (
    <main className="adminShell">
      <AdminHeader active="feedback" kicker="User Feedback Desk" title="问题反馈收件箱" />

      <section className="adminStatsGrid feedbackStatsGrid">
        <article>
          <span>待审核</span>
          <strong>{pendingReports.length}</strong>
          <em>新反馈</em>
        </article>
        <article>
          <span>有效问题</span>
          <strong>{validReports.length}</strong>
          <em>待跟进</em>
        </article>
        <article>
          <span>已处理</span>
          <strong>{resolvedReports.length}</strong>
          <em>完成闭环</em>
        </article>
        <article>
          <span>无效反馈</span>
          <strong>{invalidReports.length}</strong>
          <em>已过滤</em>
        </article>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>01</span>
          <strong>待审核反馈</strong>
        </div>
        <FeedbackReportList reports={pendingReports} notes={notes} setNotes={setNotes} reviewReport={reviewReport} />
        <p className="adminStatusLine">{status}</p>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>02</span>
          <strong>已归档反馈</strong>
        </div>
        <FeedbackReportList reports={[...validReports, ...resolvedReports, ...invalidReports]} notes={notes} setNotes={setNotes} reviewReport={reviewReport} />
      </section>
    </main>
  );
}

function FeedbackReportList({
  reports,
  notes,
  setNotes,
  reviewReport
}: {
  reports: FeedbackReport[];
  notes: Record<string, string>;
  setNotes: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  reviewReport: (id: string, status: FeedbackStatus) => Promise<void>;
}) {
  if (!reports.length) return <em className="feedbackEmptyState">暂无反馈。</em>;

  return (
    <div className="feedbackReportList">
      {reports.map((report) => (
        <article className={`feedbackReportCard ${report.status}`} key={report.id}>
          <div className="feedbackReportBody">
            <header>
              <div>
                <strong>{report.title}</strong>
                <span>{report.customerPhone} · {report.actorName ?? "默认同事"} · {formatDate(report.createdAt)}</span>
              </div>
              <b>{feedbackStatusLabel(report.status)}</b>
            </header>
            <p>{report.description}</p>
            <div className="rechargeOrderMeta">
              <span>用户 ID：{report.customerId}</span>
              {report.contact ? <span>联系：{report.contact}</span> : null}
              <span>截图：{report.screenshots.length} 张</span>
            </div>
            {report.screenshots.length ? (
              <div className="feedbackScreenshotGrid">
                {report.screenshots.map((screenshot) => (
                  <a href={screenshot.imageUrl} target="_blank" rel="noreferrer" key={screenshot.imageUrl}>
                    <img alt={screenshot.filename} src={screenshot.imageUrl} />
                  </a>
                ))}
              </div>
            ) : null}
            <textarea
              placeholder="管理员备注，例如：已复现 / 与某接口超时有关 / 用户误操作"
              rows={3}
              value={notes[report.id] ?? report.adminNote ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
            />
            <div className="adminActionRow">
              <button type="button" onClick={() => void reviewReport(report.id, "valid")}>标记有效</button>
              <button type="button" onClick={() => void reviewReport(report.id, "invalid")}>标记无效</button>
              <button type="button" onClick={() => void reviewReport(report.id, "resolved")}>标记已处理</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function feedbackStatusLabel(status: FeedbackStatus): string {
  if (status === "valid") return "有效";
  if (status === "invalid") return "无效";
  if (status === "resolved") return "已处理";
  return "待审核";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
