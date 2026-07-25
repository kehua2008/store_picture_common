import { existsSync } from "fs";
import { mkdir, readdir, writeFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import { persistentUploadSubdir } from "./storagePaths";
import type { VideoComposer, VideoError, VideoJob } from "../domain/jobs/videoJobs";

export type VideoCompositionCapabilities = {
  composerAvailable: boolean;
  ttsAvailable: boolean;
  musicLibraryAvailable: boolean;
  nativeMusicAvailable: boolean;
};

export function videoCompositionCapabilities(): VideoCompositionCapabilities {
  return {
    composerAvailable: Boolean(ffmpegPath()),
    ttsAvailable: Boolean(process.env.ALIYUN_TTS_APP_KEY?.trim() && process.env.ALIYUN_TTS_TOKEN?.trim()),
    musicLibraryAvailable: Boolean(process.env.VIDEO_MUSIC_DIR?.trim()),
    nativeMusicAvailable: Boolean(process.env.ARK_VIDEO_API_KEY?.trim() && process.env.ARK_VIDEO_BASE_URL?.trim() && process.env.ARK_VIDEO_MODEL?.trim())
  };
}

export class FfmpegVideoComposer implements VideoComposer {
  async compose(job: VideoJob): Promise<{ ok: true; url: string } | { ok: false; error: VideoError }> {
    const capabilities = videoCompositionCapabilities();
    if (!capabilities.composerAvailable) return failure("composer_not_configured", "视频合成服务暂未配置，视觉分镜已保留，可在服务恢复后继续合成。", true);
    if (job.creativePlan?.audioMode === "tts" && !capabilities.ttsAvailable) return failure("tts_not_configured", "阿里云智能语音尚未配置，无法生成真实配音。", false);
    if (job.creativePlan?.musicMode === "library" && !capabilities.musicLibraryAvailable) return failure("music_library_not_configured", "站内可商用音乐库尚未配置，无法添加背景音乐。", false);
    if (job.creativePlan?.musicMode === "native" && !capabilities.nativeMusicAvailable) return failure("native_music_not_configured", "原生自动配乐服务尚未配置。", false);
    const sourceUrls = job.scenes?.map((scene) => scene.resultUrl).filter((url): url is string => Boolean(url)) ?? [];
    if (!sourceUrls.length) return failure("composition_missing_source", "视频合成缺少已完成分镜。", false);
    try {
      const workDir = persistentUploadSubdir(path.join("video-sources", "work", job.id));
      const outputDir = persistentUploadSubdir(path.join("video-sources", "results"));
      await mkdir(workDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
      const videoFiles = await Promise.all(sourceUrls.map((url, index) => download(url, path.join(workDir, `scene-${index + 1}.mp4`))));
      const listFile = videoFiles.length > 1 ? path.join(workDir, "concat.txt") : undefined;
      if (listFile) await writeFile(listFile, videoFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
      const audioFile = job.creativePlan?.audioMode === "tts" ? await synthesizeAliyunTts(narrationFor(job), path.join(workDir, "narration.mp3")) : undefined;
      const musicFile = job.creativePlan?.musicMode === "library" ? await chooseMusic() : undefined;
      const captionsFile = job.creativePlan?.captionMode === "burned" ? await writeCaptions(job, path.join(workDir, "captions.ass")) : undefined;
      const output = path.join(outputDir, `${job.id}-final.mp4`);
      await runFfmpeg(buildArgs({ sourceFile: videoFiles.length === 1 ? videoFiles[0] : undefined, listFile, audioFile, musicFile, nativeAudio: job.creativePlan?.musicMode === "native", captionsFile, output, duration: job.durationSeconds }));
      const baseUrl = process.env.APP_PUBLIC_BASE_URL?.replace(/\/$/, "");
      if (!baseUrl) return failure("public_base_url_required", "视频合成完成，但未配置公网结果地址。", false);
      return { ok: true, url: `${baseUrl}/video-sources/results/${encodeURIComponent(path.basename(output))}` };
    } catch (error) {
      return failure("composition_failed", error instanceof Error ? error.message.slice(0, 500) : "视频合成失败，请稍后重试。", true);
    }
  }
}

async function download(url: string, destination: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("无法下载已完成的视频分镜。");
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

async function synthesizeAliyunTts(text: string, destination: string): Promise<string> {
  const appKey = process.env.ALIYUN_TTS_APP_KEY?.trim();
  const token = process.env.ALIYUN_TTS_TOKEN?.trim();
  if (!appKey || !token) throw new Error("阿里云智能语音尚未配置。");
  const query = new URLSearchParams({ appkey: appKey, token, text: text || "商品真实呈现，欢迎了解。", format: "mp3", sample_rate: "16000", voice: process.env.ALIYUN_TTS_VOICE?.trim() || "xiaoyun" });
  const endpoint = process.env.ALIYUN_TTS_ENDPOINT?.trim() || "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts";
  const response = await fetch(`${endpoint}?${query}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !/audio\//i.test(response.headers.get("content-type") ?? "")) throw new Error("阿里云智能语音未返回可用音频。");
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

async function chooseMusic(): Promise<string> {
  const directory = process.env.VIDEO_MUSIC_DIR?.trim();
  if (!directory) throw new Error("站内音乐库尚未配置。");
  const files = (await readdir(directory)).filter((file) => /\.(mp3|m4a|wav|aac)$/i.test(file));
  if (!files.length) throw new Error("站内音乐库没有可用音乐。");
  return path.join(directory, files[0]);
}

async function writeCaptions(job: VideoJob, destination: string): Promise<string> {
  const events = captionEventsFor(job);
  const content = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "",
    "[V4+ Styles]", "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding", "Style: Default,Noto Sans CJK SC,52,&H00FFFFFF,&H000000FF,&H90000000,&H50000000,1,0,0,0,100,100,0,0,1,2,0,2,80,80,130,1", "",
    "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text", ...events
  ].join("\n");
  await writeFile(destination, content);
  return destination;
}

function buildArgs(input: { sourceFile?: string; listFile?: string; audioFile?: string; musicFile?: string; nativeAudio?: boolean; captionsFile?: string; output: string; duration: number }): string[] {
  const args = input.sourceFile ? ["-y", "-i", input.sourceFile] : ["-y", "-f", "concat", "-safe", "0", "-i", input.listFile!];
  if (input.audioFile) args.push("-i", input.audioFile);
  if (input.musicFile) args.push("-stream_loop", "-1", "-i", input.musicFile);
  if (!input.audioFile && !input.musicFile && !input.nativeAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  const audioInputs = (input.audioFile ? 1 : 0) + (input.musicFile ? 1 : 0);
  if (input.audioFile && input.musicFile) args.push("-filter_complex", "[1:a]volume=1[a];[2:a]volume=0.16[b];[a][b]amix=inputs=2:duration=first:dropout_transition=0[aout]", "-map", "0:v:0", "-map", "[aout]");
  else if (input.audioFile && input.nativeAudio) args.push("-filter_complex", "[0:a]volume=0.16[music];[1:a]volume=1[voice];[music][voice]amix=inputs=2:duration=first:dropout_transition=0[aout]", "-map", "0:v:0", "-map", "[aout]");
  else args.push("-map", "0:v:0", "-map", input.nativeAudio ? "0:a:0" : `${audioInputs ? 1 : 1}:a:0`);
  if (input.captionsFile) args.push("-vf", `ass=${input.captionsFile.replace(/:/g, "\\:").replace(/'/g, "\\'")}`);
  args.push("-t", String(input.duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", input.output);
  return args;
}

function runFfmpeg(args: string[]): Promise<void> {
  const executable = ffmpegPath();
  if (!executable) return Promise.reject(new Error("未找到 FFmpeg。"));
  return new Promise((resolve, reject) => {
    const process = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    process.stderr.on("data", (chunk) => { error += String(chunk); });
    process.once("error", reject);
    process.once("close", (code) => code === 0 ? resolve() : reject(new Error(error.slice(-800) || "FFmpeg 合成失败。")));
  });
}

function timedNarrativeItems(job: VideoJob) { return job.creativePlan?.directorBeats ?? job.creativePlan?.scenes ?? []; }
export function narrationFor(job: VideoJob) { return timedNarrativeItems(job).map((item) => item.narration).filter(Boolean).join("。") || "商品真实呈现，欢迎了解。"; }
export function captionEventsFor(job: VideoJob) { return timedNarrativeItems(job).filter((item) => item.caption.trim()).map((item) => `Dialogue: 0,${assTime(item.startSeconds)},${assTime(item.endSeconds)},Default,,0,0,0,,${escapeAss(item.caption)}`); }
function assTime(seconds: number) { const safe = Math.max(0, seconds); return `0:${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}.${Math.round((safe % 1) * 100).toString().padStart(2, "0")}`; }
function escapeAss(value: string) { return value.replace(/[\\{}]/g, "").replace(/\n/g, "\\N"); }
function ffmpegPath() { const candidate = process.env.FFMPEG_PATH?.trim() || "/usr/bin/ffmpeg"; return existsSync(candidate) ? candidate : undefined; }
function failure(code: string, message: string, retryable: boolean): { ok: false; error: VideoError } { return { ok: false, error: { code, message, retryable } }; }
