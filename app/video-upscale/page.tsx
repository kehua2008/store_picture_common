"use client";

import Link from "next/link";
import { type DragEvent, useMemo, useRef, useState } from "react";

type TargetResolution = "720p" | "1080p" | "2k" | "4k";
type UpscaleStatus = "submitted" | "succeeded";

type SourceState = {
  previewUrl: string;
  sourceResolution?: string;
  durationSeconds?: number;
  label: string;
};

type LocalUpscaleTask = {
  id: string;
  status: UpscaleStatus;
  targetResolution: TargetResolution;
  sourceResolution?: string;
  durationSeconds?: number;
  createdAt: string;
  previewUrl?: string;
};

const targetOptions: Array<{ id: TargetResolution; label: string; desc: string }> = [
  { id: "720p", label: "720P", desc: "轻量提清晰度" },
  { id: "1080p", label: "1080P", desc: "常用高清成片" },
  { id: "2k", label: "2K", desc: "更适合二次剪辑" },
  { id: "4k", label: "4K", desc: "最高规格输出" }
];

export default function VideoUpscalePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceState>();
  const [targetResolution, setTargetResolution] = useState<TargetResolution>("1080p");
  const [recentTasks, setRecentTasks] = useState<LocalUpscaleTask[]>([]);
  const [currentTask, setCurrentTask] = useState<LocalUpscaleTask>();
  const [status, setStatus] = useState("可以上传本地视频，或从生成页/记录页进入高清输出。");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const canCreate = Boolean(source && !creating && !uploading && (!source.durationSeconds || source.durationSeconds <= 15));
  const activeTask = currentTask ?? recentTasks[0];
  const resultUrl = activeTask?.previewUrl;

  async function uploadSourceVideo(file: File) {
    setUploading(true);
    setCurrentTask(undefined);
    const localPreviewUrl = URL.createObjectURL(file);
    const metadata = await probeVideoMetadata(localPreviewUrl).catch(() => undefined);
    if (!metadata) {
      URL.revokeObjectURL(localPreviewUrl);
      setUploading(false);
      setStatus("无法识别这个视频，请换一个 mp4、mov 或 webm 文件。");
      return;
    }
    setSource({
      previewUrl: localPreviewUrl,
      sourceResolution: inferResolution(metadata.height),
      durationSeconds: metadata.durationSeconds,
      label: "本地上传视频"
    });
    setUploading(false);
    setStatus(metadata.durationSeconds > 15 ? "当前视频超过 15 秒，请先裁剪到 15 秒以内再提交高清输出。" : "视频已上传，可以选择目标清晰度。");
  }

  function clearSourceVideo() {
    if (source?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(source.previewUrl);
    setSource(undefined);
    setCurrentTask(undefined);
    setStatus("可以拖拽视频到来源区域，也可以点击选择本地视频。");
  }

  function handleSourceDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("video/"));
    if (file) void uploadSourceVideo(file);
  }

  function createUpscaleTask() {
    if (!source || !canCreate) return;
    setCreating(true);
    setStatus("正在创建高清输出任务...");
    window.setTimeout(() => {
      const task: LocalUpscaleTask = {
        id: `common-upscale-${Date.now()}`,
        status: "succeeded",
        targetResolution,
        sourceResolution: source.sourceResolution,
        durationSeconds: source.durationSeconds,
        createdAt: new Date().toISOString(),
        previewUrl: source.previewUrl
      };
      setCurrentTask(task);
      setRecentTasks((current) => [task, ...current].slice(0, 6));
      setCreating(false);
      setStatus("高清输出工作台已创建预览任务；真实超分接口接入后会在这里生成高清视频。");
    }, 600);
  }

  const createButtonText = useMemo(() => {
    if (creating) return "正在创建任务...";
    return `生成 ${targetResolutionLabel(targetResolution)}`;
  }, [creating, targetResolution]);

  return (
    <main className="videoUpscalePage commonVideoUpscalePage">
      <header className="stationHeader videoUpscaleSiteHeader">
        <Link className="logoMark" href="/" aria-label="返回首页">
          <img alt="" src="/brand-logo.svg" />
        </Link>
        <h1>通用百货AI创作平台</h1>
        <div className="headerSlogan" aria-label="网站广告语">
          <strong>一个视频或一句话，生成你想要的视频！</strong>
        </div>
        <Link className="accountButton videoUpscaleAccountLink" href="/account">我的</Link>
        <nav>
          <Link href="/">图像生成</Link>
          <Link className="active" href="/">视频生成</Link>
        </nav>
      </header>

      <section className="videoUpscaleHero">
        <div>
          <span>HD Output</span>
          <h1>视频高清转换器</h1>
          <p>刚生成的视频、历史视频、本地视频都可以在这里统一做高清输出。</p>
        </div>
        <nav className="videoUpscaleUtilityNav">
          <Link className="videoUpscaleBackLink" href="/">返回上一个页面</Link>
          <Link href="/generation-records?tab=videos">视频记录</Link>
        </nav>
        <input
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
          hidden
          ref={fileInputRef}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadSourceVideo(file);
            event.currentTarget.value = "";
          }}
        />
      </section>

      <section className="videoUpscaleWorkbench">
        <div className="videoUpscalePreviewPanel">
          <div className="videoUpscalePanelHeader">
            <span>来源视频</span>
            <strong>{source?.label ?? "等待选择视频"}</strong>
          </div>
          {source ? (
            <div className="videoUpscalePreview">
              <video controls playsInline src={source.previewUrl} />
              <button className="videoUpscaleRemoveSource" type="button" onClick={clearSourceVideo}>删除该视频素材</button>
            </div>
          ) : (
            <button
              className="videoUpscaleEmpty"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleSourceDrop}
            >
              <strong>拖拽视频到这里</strong>
              <i aria-hidden="true">+</i>
              <span>也可以点击选择本地视频；从生成结果选择清晰度进入时会自动带入刚生成的视频。</span>
            </button>
          )}
          <div className="videoUpscaleSourceMeta">
            <p><span>源清晰度</span><strong>{source?.sourceResolution?.toUpperCase() ?? "-"}</strong></p>
            <p><span>时长</span><strong>{source?.durationSeconds ? `${Math.round(source.durationSeconds)}秒` : "-"}</strong></p>
            <p><span>来源</span><strong>{source ? "本地上传" : "-"}</strong></p>
          </div>
        </div>

        <aside className="videoUpscaleControlPanel">
          <div className="videoUpscalePanelHeader">
            <span>高清输出选择</span>
            <strong>选择后创建独立高清任务</strong>
          </div>
          <div className="videoUpscaleTargetGrid">
            {targetOptions.map((item) => (
              <button className={targetResolution === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setTargetResolution(item.id)}>
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
          <div className="videoUpscaleNotice warning">
            <strong>高清输出服务待接入</strong>
            <span>当前先保留鞋子站一致的高清工作台流程；真实超分接口接入前不会创建假任务，也不会扣费。</span>
          </div>
          <button className="videoUpscaleCreateButton" disabled={!canCreate} type="button" onClick={createUpscaleTask}>
            {createButtonText}
          </button>
          <p className="videoUpscaleStatus">{uploading ? "正在读取视频..." : status}</p>
        </aside>
      </section>

      <section className="videoUpscaleResultPanel">
        <div className="videoUpscalePanelHeader">
          <span>高清输出结果</span>
          <strong>{activeTask ? upscaleStatusText(activeTask.status) : "还没有高清任务"}</strong>
        </div>
        {resultUrl ? (
          <div className="videoUpscaleResultGrid">
            <video controls playsInline src={resultUrl} />
            <div>
              <strong>{targetResolutionLabel(activeTask!.targetResolution)} 高清视频</strong>
              <span>{activeTask?.sourceResolution?.toUpperCase() ?? "源视频"} · {activeTask?.durationSeconds ? `${Math.round(activeTask.durationSeconds)}秒` : "时长未知"}</span>
              <button type="button" onClick={() => void saveUrlAsFile(resultUrl, buildUpscaleDownloadName(activeTask))}>下载高清视频</button>
            </div>
          </div>
        ) : (
          <div className="videoUpscaleResultEmpty">
            <strong>{activeTask ? upscaleStatusText(activeTask.status) : "等待创建高清输出任务"}</strong>
            <span>结果生成后会出现在这里。</span>
          </div>
        )}
      </section>

      <section className="videoUpscaleHistory">
        <div className="videoUpscalePanelHeader">
          <span>最近高清任务</span>
          <strong>{recentTasks.length} 个</strong>
        </div>
        {recentTasks.length ? recentTasks.map((task) => (
          <article key={task.id}>
            <div>
              <strong>{targetResolutionLabel(task.targetResolution)}</strong>
              <span>{formatDateTime(task.createdAt)} · {upscaleStatusText(task.status)}</span>
            </div>
            <span>{task.sourceResolution?.toUpperCase() ?? "源视频"} · {task.durationSeconds ? `${Math.round(task.durationSeconds)}秒` : "时长未知"}</span>
            {task.previewUrl ? <button type="button" onClick={() => void saveUrlAsFile(task.previewUrl!, buildUpscaleDownloadName(task))}>下载</button> : null}
          </article>
        )) : (
          <div className="videoUpscaleResultEmpty">
            <strong>暂无高清输出记录</strong>
            <span>创建任务后会在这里显示。</span>
          </div>
        )}
      </section>
    </main>
  );
}

function targetResolutionLabel(value: TargetResolution): string {
  if (value === "2k") return "2K";
  if (value === "4k") return "4K";
  return value.toUpperCase();
}

function inferResolution(height: number): string {
  if (height >= 2160) return "4k";
  if (height >= 1440) return "2k";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  return "480p";
}

function probeVideoMetadata(url: string): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        durationSeconds: Math.ceil(video.duration || 0),
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    video.onerror = () => reject(new Error("video_metadata_failed"));
    video.src = url;
  });
}

function upscaleStatusText(status: UpscaleStatus): string {
  const labels: Record<UpscaleStatus, string> = {
    submitted: "高清视频生成中",
    succeeded: "已完成"
  };
  return labels[status] ?? status;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function saveUrlAsFile(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildUpscaleDownloadName(task: LocalUpscaleTask | undefined): string {
  return `${task?.id ?? "video-upscale"}-${task?.targetResolution ?? "hd"}.mp4`;
}
