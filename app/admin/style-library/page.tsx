"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { describeNetworkFailure, describeRequestFailure, readJsonRecord, redirectToAdminLogin } from "@/client/httpStatus";
import { AdminHeader } from "../AdminNav";

type StyleSampleStatus = "pending_analysis" | "pending_review" | "approved" | "rejected";
type StyleCandidateBatchStatus = "collecting" | "exported" | "analyzed" | "imported" | "archived";
type StyleBoardStatus = "draft" | "ready_to_publish" | "published" | "archived";

type StyleSample = {
  id: string;
  filename: string;
  imageUrl: string;
  sourceType: string;
  platform: string;
  category: string;
  imageType: string;
  styleName: string;
  status: StyleSampleStatus;
  analysis: {
    background: string[];
    lighting: string[];
    camera: string[];
    pose: string[];
    palette: string[];
    avoid: string[];
    qualityScore: number;
    summary: string;
  };
  suggestion?: {
    category?: string;
    imageType?: string;
    styleName?: string;
    confidence: number;
    reasoning: string;
    tags: string[];
  };
  analyzer?: string;
  createdAt: string;
};

type StyleBoard = {
  id: string;
  platform: string;
  category: string;
  imageType: string;
  styleName: string;
  sampleCount: number;
  status: StyleBoardStatus;
  showOnHome: boolean;
  displayOrder: number;
  version: number;
  rules: {
    mustUse: string[];
    avoid: string[];
    background: string[];
    lighting: string[];
    camera: string[];
    pose: string[];
    palette: string[];
    prompt: string;
    promptCore?: string;
    promptVariants?: string[];
    negativePrompt?: string;
  };
  updatedAt: string;
};

type StyleCandidateBatch = {
  id: string;
  name: string;
  sampleIds: string[];
  sourceNote?: string;
  status: StyleCandidateBatchStatus;
  createdAt: string;
  updatedAt: string;
  exportedAt?: string;
  importedAt?: string;
};

type QueuedFile = {
  id: string;
  file: File;
  previewUrl: string;
};

const platforms = [
  ["taobao", "天猫/淘宝"],
  ["xiaohongshu", "小红书"],
  ["douyin", "抖音"],
  ["jd", "京东"],
  ["shopify", "独立站"],
  ["free", "通用"]
];

const categories = [
  ["general_merchandise", "通用百货"],
  ["home_textile", "家纺家居"],
  ["kitchenware", "厨房水杯"],
  ["small_appliance", "日用小家电"],
  ["storage_cleaning", "收纳清洁"],
  ["personal_gift", "个护礼品"]
];

const imageTypes = [
  ["style_candidate", "风格候选图"],
  ["scene_main", "场景主图"],
  ["white_main", "白底主图"],
  ["studio_main", "棚拍主图"],
  ["detail_header_poster", "详情页海报"],
  ["detail_texture", "材质细节"],
  ["detail_scene_lifestyle", "场景搭配"],
  ["feed_card", "信息流图"],
  ["live_cover", "直播封面"]
];

const seedStyles = ["极简高级", "韩系松弛", "老钱质感", "高街潮流", "山系机能", "待归类风格"];

export default function StyleLibraryAdminPage() {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [boards, setBoards] = useState<StyleBoard[]>([]);
  const [candidateBatches, setCandidateBatches] = useState<StyleCandidateBatch[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queuedFilesRef = useRef<QueuedFile[]>([]);
  const [sourceNote, setSourceNote] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [analysisJson, setAnalysisJson] = useState("");
  const [status, setStatus] = useState("等待上传样本");
  const [loadError, setLoadError] = useState("");
  const grouped = useMemo(() => {
    const map = new Map<string, { platform: string; category: string; imageType: string; styleName: string; count: number }>();
    samples.filter((sample) => sample.status === "approved").forEach((sample) => {
      const key = [sample.platform, sample.category, sample.imageType, sample.styleName].join("::");
      const current = map.get(key) ?? { platform: sample.platform, category: sample.category, imageType: sample.imageType, styleName: sample.styleName, count: 0 };
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [samples]);
  const pendingSamples = useMemo(() => samples.filter((sample) => sample.status === "pending_review" || sample.status === "pending_analysis"), [samples]);
  const approvedSamples = useMemo(() => samples.filter((sample) => sample.status === "approved"), [samples]);
  const rejectedSamples = useMemo(() => samples.filter((sample) => sample.status === "rejected"), [samples]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    queuedFilesRef.current = queuedFiles;
  }, [queuedFiles]);

  useEffect(() => {
    return () => queuedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/style-library");
      const body = await readJsonRecord(response);
      if (!response.ok) {
        const message = describeRequestFailure("风格库数据读取失败", response, body);
        setSamples([]);
        setBoards([]);
        setCandidateBatches([]);
        setLoadError(message);
        setStatus(message);
        if (response.status === 401 || response.status === 403) redirectToAdminLogin();
        return;
      }
      setSamples(Array.isArray(body.samples) ? body.samples as StyleSample[] : []);
      setBoards(Array.isArray(body.boards) ? body.boards as StyleBoard[] : []);
      setCandidateBatches(Array.isArray(body.candidateBatches) ? body.candidateBatches as StyleCandidateBatch[] : []);
      setLoadError("");
    } catch (error) {
      const message = describeNetworkFailure("风格库数据读取失败", error);
      setSamples([]);
      setBoards([]);
      setCandidateBatches([]);
      setLoadError(message);
      setStatus(message);
    }
  }

  function addQueuedFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!selected.length) return;
    setQueuedFiles((current) => [
      ...current,
      ...selected.map((file) => ({
        id: `${file.name}-${file.lastModified}-${createClientId()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
    event.target.value = "";
    setStatus(`已加入 ${selected.length} 张，当前候选图 ${queuedFiles.length + selected.length} 张`);
  }

  function removeQueuedFile(id: string) {
    setQueuedFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearQueuedFiles() {
    queuedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setQueuedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadSamples(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!queuedFiles.length) {
      setStatus("请先选择样本图片");
      return;
    }
    const formData = new FormData();
    queuedFiles.forEach((item) => formData.append("images", item.file, item.file.name));
    formData.append("sourceType", "admin_upload");
    formData.append("status", "approved");
    formData.append("platform", "free");
    formData.append("category", "general_merchandise");
    formData.append("imageType", "style_candidate");
    formData.append("styleName", "待 Codex 分析");
    formData.append("sourceNote", sourceNote);
    setStatus("正在上传候选图，完成后会自动创建候选批次...");
    const response = await fetch("/api/style-library/samples", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`上传失败：${body.error ?? "unknown_error"}`);
      return;
    }
    const sampleIds = Array.isArray(body.samples) ? body.samples.map((sample: StyleSample) => sample.id).filter(Boolean) : [];
    if (sampleIds.length) {
      const candidateResponse = await fetch("/api/style-library/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: candidateName.trim() || `Codex 风格分析候选 ${new Date().toLocaleString()}`,
          sampleIds,
          sourceNote: sourceNote || `本批次 ${sampleIds.length} 张图等待 Codex 自动聚类`
        })
      });
      const candidateBody = await candidateResponse.json().catch(() => ({}));
      if (!candidateResponse.ok) {
        setStatus(`图片已上传，但候选批次创建失败：${candidateBody.error ?? "unknown_error"}`);
        await refresh();
        return;
      }
      setCandidateName("");
    }
    clearQueuedFiles();
    setStatus(`已上传 ${body.samples?.length ?? 0} 张候选图，并创建 Codex 分析批次。下一步导出 zip 给 Codex 聚类。`);
    await refresh();
  }

  async function rebuildBoard(group: { platform: string; category: string; imageType: string; styleName: string }) {
    setStatus("正在重建风格板...");
    const response = await fetch("/api/style-library/styleboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...group, publish: true })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`风格板生成失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(`${body.board.styleName} 已发布到前台经典风格区`);
    await refresh();
  }

  async function createCandidateBatch() {
    const sampleIds = approvedSamples.map((sample) => sample.id);
    if (!sampleIds.length) {
      setStatus("没有已确认样本可加入候选批次");
      return;
    }
    const response = await fetch("/api/style-library/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: candidateName.trim() || undefined,
        sampleIds,
        sourceNote: `由后台已确认样本池创建，共 ${sampleIds.length} 张`
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`候选批次创建失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setCandidateName("");
    setStatus(`已创建候选批次：${body.batch.name}`);
    await refresh();
  }

  async function importAnalysisResult() {
    if (!analysisJson.trim()) {
      setStatus("请先粘贴 style-analysis-result.json 内容");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(analysisJson);
    } catch {
      setStatus("JSON 解析失败：请检查 style-analysis-result.json 是否完整、是否包含注释或多余字符");
      return;
    }
    const response = await fetch("/api/style-library/styleboards/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`分析结果导入失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setAnalysisJson("");
    setStatus(`已导入 ${body.boards?.length ?? 0} 个待发布风格板`);
    await refresh();
  }

  async function updateBoardPublishState(board: StyleBoard, patch: { status?: StyleBoardStatus; showOnHome?: boolean; displayOrder?: number }) {
    const response = await fetch("/api/style-library/styleboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id: board.id, ...patch })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`风格板发布状态更新失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(`${body.board.styleName} 已更新`);
    await refresh();
  }

  async function updateSampleStatus(id: string, nextStatus: StyleSampleStatus) {
    setStatus("正在更新样本状态...");
    const response = await fetch("/api/style-library/samples", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`样本状态更新失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setStatus(nextStatus === "approved" ? "样本已通过，可重建对应风格板" : "样本已驳回");
    await refresh();
  }

  async function updateSample(id: string, patch: Partial<Pick<StyleSample, "platform" | "category" | "imageType" | "styleName">>) {
    const response = await fetch("/api/style-library/samples", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(`样本修改失败：${body.error ?? "unknown_error"}`);
      return;
    }
    setSamples((current) => current.map((item) => (item.id === id ? body.sample : item)));
    setStatus("样本归类已更新");
  }

  return (
    <main className="adminShell">
      <AdminHeader active="style-library" kicker="Style Learning System" title="平台风格样本库" />

      <section className="adminWorkflowGrid">
        <form className="adminPanel uploadPanel" onSubmit={uploadSamples}>
          <div className="adminPanelHeader">
            <span>01</span>
            <strong>上传优质候选图</strong>
          </div>
          <input ref={fileInputRef} accept="image/png,image/jpeg,image/webp" multiple type="file" onChange={addQueuedFiles} />
          <button className="adminUploadDrop" type="button" onClick={() => fileInputRef.current?.click()}>
            <strong>只选择值得学习的好图</strong>
            <span>当前候选 {queuedFiles.length} 张。无需手动选择平台、品类、图片类型或风格名，后续由 Codex 自动聚类。</span>
          </button>
          {queuedFiles.length ? (
            <div className="queuedFileGrid">
              {queuedFiles.map((item) => (
                <article key={item.id}>
                  <img alt={item.file.name} src={item.previewUrl} />
                  <button aria-label={`移除${item.file.name}`} type="button" onClick={() => removeQueuedFile(item.id)}>×</button>
                </article>
              ))}
            </div>
          ) : null}
          <div className="adminFormGrid">
            <label>
              候选批次名
              <input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="例如：6月百货优秀主图 / 高点击风格混合样本" />
            </label>
          </div>
          <label>
            来源备注
            <textarea rows={3} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="例如：天猫家居百货优秀店铺截图 / 品牌官网图 / 自己筛选的好图" />
          </label>
          <div className="adminActionRow">
            <button disabled={!queuedFiles.length} type="submit">上传并创建 Codex 分析批次</button>
            <button disabled={!queuedFiles.length} type="button" onClick={clearQueuedFiles}>清空候选</button>
          </div>
          <p>{status}</p>
        </form>

        <section className="adminPanel">
          <div className="adminPanelHeader">
            <span>02</span>
            <strong>Codex 自动归类说明</strong>
          </div>
          {loadError ? <p className="adminStatusLine">{loadError}</p> : null}
          <div className="adminExplainBox">
            <strong>主流程</strong>
            <span>上传的图片会直接进入候选批次。管理员只判断图片是否值得学习；平台、品类、图片类型、经典风格名和通用提示词都由导出的 Codex 分析结果决定。</span>
          </div>
          <div className="adminExplainBox">
            <strong>分析目标</strong>
            <span>Codex 会把图片自动聚成若干经典风格，例如多巴胺、老钱质感、韩系松弛、城市通勤、山系机能，也可以根据图片发现新的稳定风格。</span>
          </div>
          <div className="analysisSampleList">
            {pendingSamples.map((sample) => (
              <StyleSampleReviewCard
                key={sample.id}
                sample={sample}
                onApprove={() => void updateSampleStatus(sample.id, "approved")}
                onReject={() => void updateSampleStatus(sample.id, "rejected")}
                onUpdate={(patch) => void updateSample(sample.id, patch)}
              />
            ))}
            {!loadError && !pendingSamples.length ? <em>当前没有需要人工逐张归类的图片。请在下方候选批次中导出 zip 给 Codex 分析。</em> : null}
          </div>
        </section>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>03</span>
          <strong>原始风格候选池</strong>
        </div>
        <div className="adminExplainBox">
          <strong>离线分析</strong>
          <span>候选批次只收集值得学习的优质图片；导出 zip 后交给本地 Codex Skill 自动聚类、命名经典风格、归属图片并倒推通用 prompt，再把 JSON 导回后台。</span>
        </div>
        <div className="adminFormGrid">
          <label>
            批次名称
            <input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="例如：2026-06 百货主图优秀样本" />
          </label>
          <button type="button" onClick={() => void createCandidateBatch()}>把全部候选样本合并成新批次</button>
        </div>
        <div className="styleGroupList styleGroupCards">
          {candidateBatches.map((batch) => (
            <a key={batch.id} className={batch.status === "collecting" ? "ready" : ""} href={`/api/style-library/candidates/${batch.id}/export`}>
              <strong>{batch.name}</strong>
              <span>{batch.status} · {batch.sampleIds.length} 张样本</span>
              <em>{batch.exportedAt ? `导出 ${new Date(batch.exportedAt).toLocaleString()}` : "点击导出分析包"}</em>
            </a>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !candidateBatches.length ? <em>还没有候选批次。确认样本后可在这里创建分析批次。</em> : null}
        </div>
        <label>
          粘贴 style-analysis-result.json
          <textarea rows={8} value={analysisJson} onChange={(event) => setAnalysisJson(event.target.value)} placeholder="{ &quot;batchId&quot;: &quot;...&quot;, &quot;styleGroups&quot;: [...] }" />
        </label>
        <div className="adminActionRow">
          <button disabled={!analysisJson.trim()} type="button" onClick={() => void importAnalysisResult()}>导入为待发布风格板</button>
        </div>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>04</span>
          <strong>旧流程：按已确认分组重建</strong>
        </div>
        <div className="adminExplainBox">
          <strong>兼容入口</strong>
          <span>仅用于快速重建已有粗分组。正式首页风格仍建议走候选批次、Skill 分析、导入、审核、发布。</span>
        </div>
        <div className="styleGroupList styleGroupCards">
          {grouped.map((group) => (
            <button className={group.count >= 5 ? "ready" : ""} key={`${group.platform}-${group.category}-${group.imageType}-${group.styleName}`} type="button" onClick={() => void rebuildBoard(group)}>
              <strong>{group.styleName}</strong>
              <span>{labelOf(platforms, group.platform)} · {labelOf(categories, group.category)} · {labelOf(imageTypes, group.imageType)}</span>
              <em>{group.count} 张已确认样本 · {group.count >= 5 ? "建议发布" : "可先继续补样本"}</em>
            </button>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !grouped.length ? <em>确认样本后，这里会出现可发布的风格分组。</em> : null}
        </div>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>05</span>
          <strong>已发布/草稿风格板</strong>
        </div>
        <div className="styleBoardGrid">
          {boards.map((board) => (
            <article key={board.id} className={board.status === "published" ? "styleBoardCard published" : "styleBoardCard"}>
              <header>
                <strong>{board.styleName}</strong>
                <span>{board.status} · {board.showOnHome ? "首页展示" : "不在首页"} · v{board.version} · {board.sampleCount} 张样本</span>
              </header>
              <p>{labelOf(platforms, board.platform)} · {labelOf(categories, board.category)} · {labelOf(imageTypes, board.imageType)}</p>
              <small>{board.rules.prompt}</small>
              <div className="sampleActionRow">
                <button type="button" onClick={() => void updateBoardPublishState(board, { status: "published", showOnHome: true })}>发布到首页</button>
                <button type="button" onClick={() => void updateBoardPublishState(board, { showOnHome: false })}>从首页隐藏</button>
                <button type="button" onClick={() => void updateBoardPublishState(board, { status: "archived", showOnHome: false })}>归档</button>
              </div>
            </article>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !boards.length ? <em>还没有风格板。上传样本后点击重建并发布。</em> : null}
        </div>
      </section>

      <section className="adminPanel">
        <div className="adminPanelHeader">
          <span>06</span>
          <strong>样本池</strong>
        </div>
        <div className="samplePoolStats">
          <span>待确认 {pendingSamples.length}</span>
          <span>已确认 {approvedSamples.length}</span>
          <span>已驳回 {rejectedSamples.length}</span>
        </div>
        <div className="sampleGrid">
          {samples.map((sample) => (
            <article key={sample.id}>
              <img alt={sample.filename} src={sample.imageUrl} />
              <div>
                <strong>{sample.styleName}</strong>
                <span>{labelOf(categories, sample.category)} · {labelOf(imageTypes, sample.imageType)} · {sample.status}</span>
                <small>{sample.analysis.summary}</small>
                <div className="sampleActionRow">
                  <button disabled={sample.status === "approved"} type="button" onClick={() => void updateSampleStatus(sample.id, "approved")}>通过</button>
                  <button disabled={sample.status === "rejected"} type="button" onClick={() => void updateSampleStatus(sample.id, "rejected")}>驳回</button>
                </div>
              </div>
            </article>
          ))}
          {loadError ? <em className="adminStatusLine">{loadError}</em> : null}
          {!loadError && !samples.length ? <em className="adminStatusLine">样本池暂无图片。</em> : null}
        </div>
      </section>
    </main>
  );
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function StyleSampleReviewCard({
  sample,
  onApprove,
  onReject,
  onUpdate
}: {
  sample: StyleSample;
  onApprove: () => void;
  onReject: () => void;
  onUpdate: (patch: Partial<Pick<StyleSample, "platform" | "category" | "imageType" | "styleName">>) => void;
}) {
  const tags = [
    ...sample.analysis.background.slice(0, 2),
    ...sample.analysis.lighting.slice(0, 2),
    ...sample.analysis.camera.slice(0, 2),
    ...sample.analysis.pose.slice(0, 2),
    ...sample.analysis.palette.slice(0, 2)
  ];

  return (
    <article className="analysisSampleCard">
      <img alt={sample.filename} src={sample.imageUrl} />
      <div className="analysisSampleBody">
        <header>
          <strong>{sample.styleName}</strong>
          <span>{sample.analysis.qualityScore} 分 · {sample.analyzer ?? "heuristic"} · {sample.status}</span>
        </header>
        {sample.suggestion ? (
          <div className="analysisSuggestionBox">
            <strong>系统建议：{sample.suggestion.styleName ?? sample.styleName}</strong>
            <span>置信度 {Math.round(sample.suggestion.confidence * 100)}% · {sample.suggestion.reasoning}</span>
          </div>
        ) : null}
        <div className="analysisSampleControls">
          <label>
            平台
            <select value={sample.platform} onChange={(event) => onUpdate({ platform: event.target.value })}>
              {platforms.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>
            品类
            <select value={sample.category} onChange={(event) => onUpdate({ category: event.target.value })}>
              {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>
            图片类型
            <select value={sample.imageType} onChange={(event) => onUpdate({ imageType: event.target.value })}>
              {imageTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>
            风格名
            <input
              defaultValue={sample.styleName}
              list="seed-style-list"
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== sample.styleName) onUpdate({ styleName: next });
              }}
            />
          </label>
        </div>
        <p>{sample.analysis.summary}</p>
        <div className="analysisTagList">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="sampleActionRow">
          <button type="button" onClick={onApprove}>确认归类</button>
          <button type="button" onClick={onReject}>驳回样本</button>
        </div>
      </div>
    </article>
  );
}

function labelOf(items: string[][], id: string): string {
  return items.find(([key]) => key === id)?.[1] ?? id;
}
