# 视频分镜与合成

通用站的一句话生视频按 5 秒分镜生成。上传的所有商品图用于建立产品事实卡；当前 Kling v2.5 单图接口每段只提交脚本选择的一张锚点图，不把多图上传误称为已全部传入模型。

10 秒生成两个分镜，15 秒生成三个分镜。视觉分镜全部完成后，由 FFmpeg 拼接为最终 MP4；未选择配音或配乐时，也会写入静音 AAC 音轨，保证成片含视频和音频流。

## 生产配置

```
FFMPEG_PATH=/usr/bin/ffmpeg
ALIYUN_TTS_APP_KEY=...
ALIYUN_TTS_TOKEN=...
ALIYUN_TTS_VOICE=xiaoyun
VIDEO_MUSIC_DIR=/opt/store-picture-common/music
```

未配置 `ALIYUN_TTS_APP_KEY` 和 `ALIYUN_TTS_TOKEN` 时，按文案配音会被禁用。未配置且包含合规音频素材的 `VIDEO_MUSIC_DIR` 时，自动配乐会被禁用。密钥只能保留在服务器环境变量中。
