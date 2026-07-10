"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CurrentUser = { id: string; phone: string; status: "active" | "suspended"; createdAt: string; updatedAt: string };
type CurrentActor = { actorId: string; actorName: string };
type CreditAccount = { customerId: string; balanceCredits: number; frozenCredits: number; updatedAt: string };
type RecordTab = "images" | "videos";
type RecordScope = "mine" | "all";

type GenerationRecordJob = {
  id: string;
  createdByActorId?: string;
  createdByActorName?: string;
  reservedCredits?: number;
  chargedCredits?: number;
  createdAt: string;
  updatedAt: string;
  status: "running" | "succeeded" | "partial_failed" | "failed" | "canceled";
  progress: { completed: number; total: number };
  results: Array<{ id: string; base64?: string; url?: string; mimeType: string; imageTypeLabel?: string }>;
  error?: { code: string; message: string; retryable: boolean };
};

type VideoRecordJob = {
  id: string;
  createdByActorId?: string;
  createdByActorName?: string;
  reservedCredits?: number;
  chargedCredits?: number;
  createdAt: string;
  updatedAt: string;
  status: "running" | "submitted" | "succeeded" | "failed" | "canceled";
  progress: { completed: number; total: number };
  result?: { url?: string; localUrl?: string; filename?: string; mimeType?: string; createdAt: string };
  error?: { code: string; message: string; retryable: boolean };
};

function readInitialRecordTab(): RecordTab {
  if (typeof window === "undefined") return "images";
  return new URLSearchParams(window.location.search).get("tab") === "videos" ? "videos" : "images";
}

export default function GenerationRecordsPage() {
  const [user, setUser] = useState<CurrentUser>();
  const [actor, setActor] = useState<CurrentActor>();
  const [account, setAccount] = useState<CreditAccount>();
  const [jobs, setJobs] = useState<GenerationRecordJob[]>([]);
  const [videoJobs, setVideoJobs] = useState<VideoRecordJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [status, setStatus] = useState("正在同步生成记录...");
  const [isLoading, setIsLoading] = useState(true);
  const [activeRecordTab, setActiveRecordTab] = useState<RecordTab>(readInitialRecordTab);
  const [recordScope, setRecordScope] = useState<RecordScope>("mine");

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const works = useMemo(
    () => jobs
      .filter((job) => !selectedJobId || job.id === selectedJobId)
      .flatMap((job) => job.results.map((image, index) => ({ job, image, index }))),
    [jobs, selectedJobId]
  );

  useEffect(() => {
    void refresh();
  }, [recordScope]);

  function selectRecordTab(tab: RecordTab) {
    setActiveRecordTab(tab);
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", tab === "videos" ? "/generation-records?tab=videos" : "/generation-records?tab=images");
  }

  async function refresh() {
    setIsLoading(true);
    const meResponse = await fetch("/api/auth/me").catch(() => undefined);
    if (!meResponse?.ok) {
      setUser(undefined);
      setActor(undefined);
      setAccount(undefined);
      setJobs([]);
      setVideoJobs([]);
      setStatus("请先登录后查看生成记录");
      setIsLoading(false);
      return;
    }

    const meBody = await meResponse.json().catch(() => ({}));
    setUser(meBody.user);
    setActor(meBody.actor);
    setAccount(meBody.account);

    const scopeQuery = `scope=${recordScope}`;
    const jobsResponse = await fetch(`/api/generation-jobs?${scopeQuery}`).catch(() => undefined);
    const videoJobsResponse = await fetch(`/api/video-jobs?${scopeQuery}`).catch(() => undefined);
    const jobsBody = await jobsResponse?.json().catch(() => ({}));
    const videoJobsBody = await videoJobsResponse?.json().catch(() => ({}));
    const nextJobs = Array.isArray(jobsBody?.jobs) ? jobsBody.jobs : [];
    const nextVideoJobs = Array.isArray(videoJobsBody?.jobs) ? videoJobsBody.jobs : [];
    setJobs(nextJobs);
    setVideoJobs(nextVideoJobs);
    setStatus(nextJobs.length || nextVideoJobs.length ? `已同步${recordScope === "mine" ? "我的" : "全部"}近 24 小时生成记录` : `${recordScope === "mine" ? "我的" : "全部"}近 24 小时暂无生成记录`);
    setIsLoading(false);
  }

  if (!user) {
    return (
      <main className="generationRecordsPage">
        <header className="recordsHeader">
          <Link className="recordsBrand" href="/">
            <img alt="" src="/brand-logo.svg" />
            <span>通用百货AI创作平台</span>
          </Link>
          <Link className="recordsBack" href="/">返回首页登录</Link>
        </header>
        <section className="recordsLoginPrompt">
          <strong>请先登录</strong>
          <span>登录后可查看近 24 小时生成任务、作品图片和积分结算状态。</span>
          <Link href="/">返回首页登录</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="generationRecordsPage">
      <header className="recordsHeader">
        <Link className="recordsBrand" href="/">
          <img alt="" src="/brand-logo.svg" />
          <span>通用百货AI创作平台</span>
        </Link>
        <nav>
          <Link href="/">工作台</Link>
          <Link href="/recharge">算力点充值</Link>
        </nav>
      </header>

      <section className="recordsHero">
        <div>
          <span>Generation Records</span>
          <h1>生成记录</h1>
          <p>图片和视频生成记录仅保留 24 小时，请及时下载。当前使用者：{actor?.actorName ?? "默认同事"}。</p>
        </div>
        <aside>
          <p><span>可用积分</span><strong>{formatNumber(account?.balanceCredits ?? 0)}</strong></p>
          <p><span>冻结积分</span><strong>{formatNumber(account?.frozenCredits ?? 0)}</strong></p>
          <p><span>任务</span><strong>{jobs.length + videoJobs.length}</strong></p>
        </aside>
      </section>

      <section className="recordsScopeBar" aria-label="任务范围">
        <div>
          <strong>{recordScope === "mine" ? "我的任务" : "全部任务"}</strong>
          <span>{recordScope === "mine" ? "只看当前使用者创建的任务" : "查看同一账号下所有成员任务，别人任务不可取消"}</span>
        </div>
        <div className="recordsScopeSwitch">
          <button className={recordScope === "mine" ? "active" : ""} type="button" onClick={() => setRecordScope("mine")}>我的任务</button>
          <button className={recordScope === "all" ? "active" : ""} type="button" onClick={() => setRecordScope("all")}>全部任务</button>
        </div>
      </section>

      <section className="recordsNotice">
        <strong>{status}</strong>
        <span>{isLoading ? "正在刷新..." : `${works.length} 张图片 · ${videoJobs.length} 个视频任务 · ${jobs.filter((job) => job.status === "running").length + videoJobs.filter((job) => job.status === "running" || job.status === "submitted").length} 个运行中任务`}</span>
      </section>

      <section className="recordsWorkspace">
        <div className="recordsWorksColumn">
          <header className="recordsSectionHeader">
            <div>
              <span>Works</span>
              <h2>{activeRecordTab === "images" ? selectedJob ? `${recordTitle(selectedJob)} 的作品` : "图片作品" : "视频作品"}</h2>
            </div>
            {activeRecordTab === "images" && selectedJob ? <button type="button" onClick={() => setSelectedJobId("")}>查看全部</button> : null}
          </header>
          <div className="recordsTabs" role="tablist" aria-label="作品类型">
            <button className={activeRecordTab === "images" ? "active" : ""} type="button" onClick={() => selectRecordTab("images")}>
              图片作品 <span>{works.length}</span>
            </button>
            <button className={activeRecordTab === "videos" ? "active" : ""} type="button" onClick={() => selectRecordTab("videos")}>
              视频作品 <span>{videoJobs.length}</span>
            </button>
          </div>
          {activeRecordTab === "images" ? (
            works.length ? (
              <div className="recordsWorkGrid" aria-label="生成作品图库">
                {works.map((item) => (
                  <article key={`${item.job.id}-${item.image.id}-${item.index}`}>
                    <img alt={item.image.imageTypeLabel ?? "生成作品"} src={imageSrc(item.image)} />
                    <div>
                      <strong>{item.image.imageTypeLabel ?? "生成作品"}</strong>
                      <span>{formatDateTime(item.job.createdAt)} · {item.job.id}</span>
                    </div>
                    <div className="downloadActionWithHint compact">
                      <a href={imageSrc(item.image)} download>下载</a>
                      <em className="downloadRetentionHint">仅保存24小时</em>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="recordsEmpty">
                <strong>暂无可下载作品</strong>
                <span>{selectedJob ? "该任务还没有生成图片。" : "成功生成后的图片会展示在这里。"}</span>
              </div>
            )
          ) : videoJobs.length ? (
            <div className="recordsVideoList" aria-label="生成视频记录">
              {videoJobs.map((job) => (
                <article key={job.id}>
                  <div className="recordsVideoPreview">
                    {job.result?.localUrl || job.result?.url ? <video muted playsInline preload="metadata" src={job.result.localUrl ?? job.result.url} /> : <strong>{videoStatusText(job)}</strong>}
                  </div>
                  <div className="recordsVideoMeta">
                    <strong>视频生成任务</strong>
                    <span>{formatDateTime(job.createdAt)} · {videoStatusText(job)} · {job.createdByActorName ?? "未标记成员"}</span>
                    <span>预计 {job.reservedCredits ?? 0} · 实际 {job.chargedCredits ?? 0}</span>
                  </div>
                  <div className="recordsVideoActions">
                    <div className="downloadActionWithHint compact">
                      <a aria-disabled={!job.result?.localUrl && !job.result?.url} href={job.result?.localUrl ?? job.result?.url ?? "#"}>下载</a>
                      {job.result?.localUrl || job.result?.url ? <em className="downloadRetentionHint">仅保存24小时</em> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="recordsEmpty">
              <strong>暂无视频记录</strong>
              <span>视频生成完成后会显示在这里。</span>
            </div>
          )}
        </div>

        <aside className="recordsTaskColumn" aria-label="任务记录">
          <header className="recordsSectionHeader compact">
            <div>
              <span>Jobs</span>
              <h2>任务记录</h2>
            </div>
          </header>
          <div className="recordsTaskList">
            {jobs.map((job) => (
              <article key={job.id} className={selectedJobId === job.id ? "active" : ""}>
                <button type="button" onClick={() => setSelectedJobId(job.id)}>
                  <span>
                    <strong>{recordTitle(job)}</strong>
                    <em>{job.id}</em>
                  </span>
                  <b className={job.status}>{statusText(job)}</b>
                </button>
                <div className="recordsProgress"><i style={{ width: `${progressPercent(job)}%` }} /></div>
                <p>
                  <span>{formatDateTime(job.createdAt)}</span>
                  <span>{job.createdByActorName ?? "未标记成员"}</span>
                  <span>{job.progress.completed}/{job.progress.total}</span>
                  <span>预计 {job.reservedCredits ?? 0}</span>
                  <span>实际 {job.chargedCredits ?? 0}</span>
                </p>
              </article>
            ))}
            {!jobs.length ? (
              <div className="recordsEmpty">
                <strong>暂无任务记录</strong>
                <span>从工作台创建任务后会出现在这里。</span>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function recordTitle(job: GenerationRecordJob): string {
  return job.id || "生成任务";
}

function statusText(job: GenerationRecordJob): string {
  if (job.status === "running") return "生成中";
  if (job.status === "succeeded") return "生成完成";
  if (job.status === "partial_failed") return "部分失败";
  if (job.status === "canceled") return "已取消";
  return "生成失败";
}

function videoStatusText(job: VideoRecordJob): string {
  if (job.status === "running") return "提交中";
  if (job.status === "submitted") return "生成中";
  if (job.status === "succeeded") return "生成完成";
  if (job.status === "canceled") return "已取消";
  return job.error?.message ?? "生成失败";
}

function progressPercent(job: GenerationRecordJob): number {
  if (!job.progress.total) return 0;
  return Math.min(100, Math.round((job.progress.completed / job.progress.total) * 100));
}

function imageSrc(image: GenerationRecordJob["results"][number]): string {
  if (image.base64) return `data:${image.mimeType};base64,${image.base64}`;
  return image.url ?? "";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
