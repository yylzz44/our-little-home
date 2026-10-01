# 与你：GitHub Pages + Supabase 部署说明

此版本保留时光轴、心愿、留言、定时信件、照片与双人宠物。女朋友只使用网站邀请和网站密码，不注册 GitHub/Supabase/ChatGPT。

## 当前状态与边界

- 本地静态构建和 PostgreSQL 权限测试可运行。
- 尚未连接用户的真实 Supabase 项目；尚未发布 GitHub Pages。
- 真实 Auth、Storage、双设备和大陆网络验收必须在项目开通后完成。
- Supabase 免费层有数据库、照片存储和流量额度；低活跃项目可能休眠。不要设置无意义的定时保活。若休眠，由项目所有者在控制台恢复。
- 本方案不购买域名，使用 GitHub 默认地址。大陆访问情况以你们两人的实际网络测试为准。

## 一次性后台设置（只由建站者操作）

1. 在 https://supabase.com/dashboard 创建专用的新免费项目。不要在已有业务项目执行本仓库 SQL。可先选 Singapore。数据库密码只保存在自己的密码管理器中。
2. 打开 SQL Editor，执行 `supabase/migrations/001_home.sql`。该脚本创建私有数据表、邀请验证触发器、权限函数和私有照片桶。
3. 在 Authentication 的 Email 设置中：启用邮箱密码登录，允许新用户注册，**关闭 Confirm email**。本网站邮箱仅作登录标识，真正的注册资格由一次性邀请和数据库触发器控制。关闭匿名登录与无需使用的其他登录提供方。建议将密码最短长度设为 10。
4. 复制 Project URL 和 Publishable key；旧版 anon key 也支持。网站不需要数据库密码、Secret key 或 service_role。不要把管理员密钥发给网站或放进代码。
5. 在 SQL Editor 执行 `supabase/002_owner_invite.sql`，得到创建者的单次激活码，有效期 7 天。妥善保管结果，不要提交到 GitHub。

## GitHub 部署

1. 在自己的 GitHub 账号下创建独立公开仓库 `our-little-home`。公开仓库只放代码、通用猫咪图片和 SQL 结构；不放真实记录、迁移数据、邀请链接或密钥。
2. 上传本项目代码。不要上传 `node_modules`、`.env.local`、测试构建、旧站导出的数据、`.git` 或 `migration-data`。
3. 仓库 Settings → Secrets and variables → Actions → Variables 增加：
   - `VITE_SUPABASE_URL`：例如 `https://项目编号.supabase.co`，末尾不加 `/`。
   - `VITE_SUPABASE_PUBLISHABLE_KEY`：公开连接密钥。
4. Settings → Pages → Source 选择 GitHub Actions。
5. Actions → Deploy our little home → Run workflow，等待部署任务成功。配置缺失或误填管理员密钥会阻止发布。
6. 按 GitHub 返回的地址访问，**不要把构建产物以外的目录作为 Pages 发布目录**。
7. 用 `网站地址/#activate=创建者激活码` 建立你的网站账号。之后在“小家设置”点击“邀请另一半加入”，将生成的链接私下发给她。她只需填昵称、邮箱和密码。

没有人需要把个人 GitHub 访问令牌输入情侣网站。公开连接密钥不是访问权限；数据库根据网站登录身份检查权限。

## 上线验收

1. 关闭代理，在电脑浏览器及手机移动网络分别打开新站。
2. 两人各自在自己的设备激活并登录，确认 30 秒内能同步心愿、留言和宠物互动。
3. 上传一张测试照片，另一设备可以查看；退出登录后无法通过 Storage API 访问它。
4. 新写一封未来信件，检查网络响应里没有正文；到期后正文出现。
5. 退出登录、重新登录、修改密码、重新打开网页、手机横竖屏均正常。
6. 只有以上成功后，再迁移旧站真实内容并正式切换。旧站暂时保留供回退。

`node scripts/check-backend.mjs` 可在设置好两个环境变量后做只读检查，验证连接、邮箱设置与匿名访问拒绝。它不能替代真实登录和大陆网络测试。

## 数据迁移与维护

- 旧站与新站的密码系统不同，账号需要重新设置密码；不能直接复制旧密码哈希。
- 迁移包中的源码不含真实数据。私有迁移 SQL 另外交付，不能放到公开仓库。
- 截至本次检查，旧站只有小家设置和 3 次宠物互动，无回忆、信件、照片或回复。正式切换前必须重新读取旧站，避免漏掉新增内容。
- 普通记录删除后，照片可能仍留在私有桶中。为防止误删其他记录的共享图片，客户端没有直接删除文件权限；由所有者定期在控制台检查并清理未引用对象。
- 照片输入上限 8 MB，客户端压缩至最长边 1920 像素、输出不超过 2 MB；GIF 变为静态图片。照片通过登录后下载为内存对象 URL，不使用永久公开链接。
- 用户忘记网站密码时，由后台所有者协助恢复。本次不配置邮箱自动找回，因此不要承诺自动发送找回邮件。
- 备份时使用 Supabase 控制台/受控导出方式，包含私有 `home_private` 表和 `home-photos` 文件。普通网页快照会隐藏未到期信件正文，不是完整备份。

## 本地开发与验证

需要 Node.js 24 和 pnpm 11.25.0。将 `.env.github.example` 复制成 `.env.local` 后填公开连接配置。

```sh
pnpm install --frozen-lockfile
pnpm test:github
pnpm build:github
pnpm dev:github
```

`supabase/tests/security.test.mjs` 使用 PGlite 中的真实 PostgreSQL 语义测试权限函数，模拟 Auth 和 Storage 的平台表；并没有模拟 Supabase 托管网络/邮件或声称完成线上测试。

## 架构和安全约束

- 原 UI 复用；静态入口在 `github/`。页面不运行 Next/Cloudflare 服务端代码。
- 数据放在不公开的 `home_private` schema；业务访问仅通过固定 RPC，所有函数绑定服务器确认的身份。
- RLS 启用，匿名无 RPC 权限，用户不可直接读取私有表。所有 security-definer 函数固定 search_path。
- 激活码为约 244 位随机数，只存 SHA-256 摘要；数据库事务内锁定并消费邀请，只能创建两个成员，不能靠改用户 metadata 提权。
- 身份同时检查有效 Auth session；退出/撤销的 session 不可继续通过旧 JWT 访问业务数据。
- 密封信件由服务器时间判断，客户端拿不到未到期正文；宠物冷却与写入在同一事务内处理。
- Supabase JS、React、Radix 和现有组件负责通用能力，不自行实现密码哈希或 JWT。

官方资料：
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
