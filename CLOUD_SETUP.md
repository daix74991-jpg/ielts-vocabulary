# 单词本邮箱同步配置

网页仍由 GitHub Pages 提供。Supabase 负责邮箱账号和每个账号独立的星标数据。

`dist/cloud-config.js` 已连接项目 `wdbxjxyxyxjfnmokbfsg`，云端数据表与按账号隔离的 RLS 策略已创建。真实账号的两端同步仍需登录后验证；用户于 2026-10-04 明确确认关闭邮箱验证，新账号注册后直接登录；未配置 SMTP，暂不支持邮件找回。

1. 在自己的 Supabase 账号下创建项目。使用 Free 方案，不需要为此升级付费。
2. 在 SQL Editor 执行 `cloud-schema.sql`。该表启用 RLS；访问条件为登录用户 UID 与该行的 `user_id` 一致。匿名用户不能读写。不要改成公开读写。
3. 在 Authentication 的 Email provider 开启邮箱密码登录，按用户要求关闭 Confirm email，实现注册后直接登录。
4. 若需要恢复密码或重新启用邮箱验证，配置自定义 SMTP。Supabase 默认发信服务只给项目团队成员发送邮件，不能用作对公众开放的邮箱注册。SMTP 密码只能填在 Supabase 后台，不能写入网页、公开仓库或浏览器配置。
5. 配置 Site URL 为 `https://daix74991-jpg.github.io/ielts-vocabulary/`，将同一地址加入 Redirect URLs，用于邮箱确认和密码恢复。
6. 将 Project URL 与 publishable key（或 anon key）写入 `dist/cloud-config.js` 的 `window.NOTEBOOK_CLOUD_CONFIG={url:'…',publicKey:'…'}`。浏览器只能使用这些公开客户端配置，严禁使用 secret key / service_role key。
7. 运行 `npm test`、`npm run build:sync`，将 `dist/` 中的网页文件部署到仓库根目录。
8. 用两个独立浏览器登录同一个测试邮箱，验证：加星、取消星标、刷新、断网后重连，以及切换另一个账号。再确认未登录请求和另一个账号均不能读取前一账号的数据。

同步以词条的章节与顺序 ID 为单位。取消收藏保存为 `starred=false`，避免旧设备重建已删除收藏。各词条独立写入，收藏其他单词不会覆盖另一设备的修改。同一词条冲突按最后成功写入云端的操作处理。

登录后的缓存和离线待上传操作按 UID 分开保存。旧的游客收藏只合并到该浏览器首次登录的账号。切换账号不会把前一账号收藏导入新账号。联网后、切回页面或点击“立即同步”会刷新；页面在前台时每 15 秒同步一次。

SDK 已打包为网站本地文件，浏览器不依赖额外 SDK CDN。云端 API 仍需要可用的网络连接。

参考：[邮箱登录](https://supabase.com/docs/guides/auth/passwords)、[SMTP 限制](https://supabase.com/docs/guides/auth/auth-smtp)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
