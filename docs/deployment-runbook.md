# 通用百货分站部署运行手册

本手册按服装分站已验证的部署结构复刻：本地 Next.js 项目同步到服务器独立目录，由 PM2 运行 Next.js，Nginx 将公网端口转发到内部端口。不要使用 Sites 构建产物，也不要覆盖服装站线上目录。

## 本地验证

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev -- --hostname 127.0.0.1 --port 3104
```

本地入口为 `http://127.0.0.1:3104`。

## 生产目标登记

```bash
export COMMON_DEPLOY_DIR=/opt/store-picture-common
export PM2_APP_NAME=store-picture-common
export COMMON_PUBLIC_PORT=6066
export COMMON_INTERNAL_PORT=3104
```

生产入口：

```text
用户端：http://47.120.21.152:6066
后台：http://47.120.21.152:6066/admin/login
```

管理员白名单沿用服装分站当前号码：

```bash
ADMIN_PHONE_NUMBERS=17705072626
ADMIN_PHONES=17705072626
```

## 生产环境变量

服务器 `.env.local` 必须放在 `$COMMON_DEPLOY_DIR/.env.local`，不要提交到 Git。

```bash
STORE_COMMON_DATA_DIR=/opt/store-picture-common/.data-common
STORE_COMMON_UPLOAD_DIR=/opt/store-picture-common/public
ADMIN_PHONE_NUMBERS=17705072626
ADMIN_PHONES=17705072626

YUNWU_API_KEY=...
YUNWU_BASE_URL=https://yunwu.ai
STYLE_VISION_PROVIDER=openai_compatible
STYLE_VISION_API_KEY=...
STYLE_VISION_BASE_URL=https://yunwu.ai
STYLE_VISION_MODEL=...

# 阿里云短信找回密码（密钥只保存在服务器 .env.local）
ALIYUN_SMS_ACCESS_KEY_ID=...
ALIYUN_SMS_ACCESS_KEY_SECRET=...
ALIYUN_SMS_SIGN_NAME=...
ALIYUN_SMS_PASSWORD_RESET_TEMPLATE_CODE=...
ALIYUN_SMS_MANUAL_RECOVERY_TEMPLATE_CODE=...
```

如果后续接入视频、高清输出或公网回源能力，需要把对应的公网基础地址配置为 `http://47.120.21.152:6066`，确保供应商可以访问素材文件。

## 从本地同步部署

```bash
rsync -az --delete \
  --exclude '.git' \
  --exclude '.data-common' \
  --exclude '.deploy-keys' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.npm-cache' \
  --exclude 'test-results' \
  --exclude 'public/feedback-screenshots' \
  --exclude 'public/recharge-proofs' \
  --exclude 'public/style-samples' \
  --exclude 'public/account-recovery-proofs' \
  ./ root@47.120.21.152:"$COMMON_DEPLOY_DIR"/
```

服务器执行：

```bash
cd "$COMMON_DEPLOY_DIR"
npm install
npm run typecheck
npm test
npm run build
pm2 start npm --name "$PM2_APP_NAME" -- run start -- --hostname 127.0.0.1 --port "$COMMON_INTERNAL_PORT"
pm2 save
```

已存在时改用：

```bash
cd "$COMMON_DEPLOY_DIR"
npm install
npm run typecheck
npm test
npm run build
pm2 restart "$PM2_APP_NAME" --update-env
pm2 save
```

## Nginx 参考配置

```nginx
server {
    listen 6066;
    server_name 47.120.21.152;
    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3104;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

修改后执行：

```bash
nginx -t
systemctl reload nginx
```

## 健康检查

```bash
curl -I http://47.120.21.152:6066/
curl -sS http://47.120.21.152:6066/api/auth/me
curl -I http://47.120.21.152:6066/admin/login
PM2_APP_NAME=store-picture-common STORE_COMMON_DATA_DIR=/opt/store-picture-common/.data-common node scripts/server-health-check.mjs
pm2 logs store-picture-common --lines 100 --nostream
tail -100 /var/log/nginx/error.log
```

预期：

- 首页、创作入口、登录页和后台登录页可访问。
- `/api/auth/me` 未登录时返回 JSON，而不是 HTML。
- 充值凭证、反馈截图、风格样本上传不会被 Nginx `413` 拦截。
- PM2 进程为 `online`，日志没有持续重启或端口占用错误。
- `.data-common` 和公开上传目录只属于通用百货分站。
- 重置密码短信模板和人工找回审核通过模板均已在阿里云审核通过；模板参数使用 `code`。
