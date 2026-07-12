# 通用百货站账号找回

通用百货站使用“手机号 + 密码”登录。旧密码只做哈希校验，不能展示或找回。

## 自动找回

- 用户从首页登录框的“忘记密码”进入 `/reset-password`。
- 输入原注册手机号后，通过阿里云短信获得 6 位验证码；接口始终返回统一提示，不披露手机号是否已注册。
- 验证码 10 分钟有效、最多验证 5 次、同手机号 60 秒后可重发，手机号每日最多 5 次、同 IP 每日最多 10 次。
- 新密码确认后，系统更新原用户 ID 的密码哈希，清除该用户全部旧会话，再创建当前新会话。积分、订单和生成记录不迁移也不丢失。

## 人工找回

- 原手机号无法使用时，用户在 `/account-recovery` 填写原手机号、当前手机号、说明及可选证明截图。
- 当前手机号须先完成短信验证。申请和证明保存于通用站 `.data-common` 与 `public/account-recovery-proofs`。
- 管理员在 `/admin/account-recovery` 审核。通过后，系统仅向已验证的新手机号发送一次性验证码；管理员不查看、也不直接设置用户密码。
- 用户带着原手机号、新手机号和验证码返回 `/reset-password` 的“人工审核后重置”页完成改密。

## 生产配置

在服务器 `/opt/store-picture-common/.env.local` 配置：

```bash
ALIYUN_SMS_ACCESS_KEY_ID=...
ALIYUN_SMS_ACCESS_KEY_SECRET=...
ALIYUN_SMS_SIGN_NAME=...
ALIYUN_SMS_PASSWORD_RESET_TEMPLATE_CODE=...
ALIYUN_SMS_MANUAL_RECOVERY_TEMPLATE_CODE=...
```

两个模板都必须有 `code` 参数。未配置或阿里云发送失败时，接口返回明确错误，不会绕过验证码修改密码。
