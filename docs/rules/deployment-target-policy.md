# 通用百货分站部署目标规则

本地项目属于独立通用百货分站，源代码目录固定为 `store_picture_common`。服装分站的服务器目录 `/opt/store-picture-maker`、公网端口 `9999`、内部端口 `3001` 和 PM2 进程 `store-picture-maker` 只能继续服务服装站，不能被通用百货分站复用或覆盖。

## 强制规则

- 通用百货分站部署目录必须通过 `COMMON_DEPLOY_DIR` 明确传入，不允许使用服装站目录。
- PM2 应用名必须通过 `PM2_APP_NAME` 明确传入，不允许使用服装站的 `store-picture-maker`。
- 公网访问端口、内部 Next.js 端口和 SSH 同步通道必须分开记录，不能混用。
- 上线前必须确认 Nginx 公网端口未被占用，内部端口未被 PM2 或其他服务占用。
- 生产数据必须独立保存在通用百货分站目录下，不能读取或写入服装站 `.data`。

## 当前建议登记

```text
本地代码目录：/Users/Admin/Desktop/works/projects/store_picture_common
服务器目录：/opt/store-picture-common
公网入口：http://47.120.21.152:6066
内部端口：127.0.0.1:3104
PM2 进程名：store-picture-common
数据目录：/opt/store-picture-common/.data-common
上传目录：/opt/store-picture-common/public
管理员白名单：17705072626
```

以上端口是当前服务器已存在并验证可访问的通用百货分站映射。真正部署前仍必须在服务器上用 `ss -lntp` 和 Nginx 配置确认没有冲突。
