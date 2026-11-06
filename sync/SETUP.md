# 可选：部署独立家庭同步接口

也可以直接使用 [GitHub 直连同步](../GITHUB_SYNC.md)，无需此接口。以下方案用于希望严格区分家长、孩子 API 权限的家庭。不要把 GitHub Token 或家长口令写进 HTML、公开仓库或聊天。

## 1. 准备账号与权限

- 一个 Cloudflare 账号，开通 Workers。此方案采用 SQLite Durable Object 限制登录尝试，按 Cloudflare 当时的账户额度与计费规则运行。
- GitHub 私有数据仓库 `5t5-5-t-5/wenzhi-mistakes-data`，主分支 `main`，初始 `state.json` 已建立时无需手动编辑。
- 为该私有仓库单独创建 Fine-grained personal access token。仓库权限只给 **Contents: Read and write**，不授权公开网页仓库或其他仓库。

官方入口：[GitHub 创建细粒度令牌](https://github.com/settings/personal-access-tokens/new)、[Cloudflare Workers](https://dash.cloudflare.com/)。

## 2. 部署接口

在此项目文件夹打开终端：

```sh
cd sync
npm ci
npx wrangler login
npx wrangler deploy
node configure.mjs
npx wrangler deploy
```

首次 deploy 先建立接口；未设置 Secrets 时接口只返回“尚未配置”，不会开放题目。`configure.mjs` 会在本地交互读取专用 GitHub Token，生成随机家长密码和签名 Secret，将它们通过标准输入写入 Cloudflare Secrets。它不会把 Token 写入文件或终端输出。家长密码显示一次，请存到密码管理器。若终端有录屏，请自行关闭录屏。

`wrangler.jsonc` 的默认值已对应本项目：`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH`、`ALLOWED_ORIGINS`。如果换域名，请同步修改 Origin。部署成功会返回 `https://wenzhi-mistakes-sync.你的子域名.workers.dev`。

服务器的三个 Secrets：

| Secret | 用途 |
| --- | --- |
| `GITHUB_TOKEN` | 仅可读写私有数据仓库的令牌 |
| `PARENT_PASSWORD_HASH` | 随机家长密码的 SHA-256 |
| `SESSION_SECRET` | 随机签名密钥，至少 32 字节 |

## 3. 连接家长端和 iPad

1. 家长端打开“同步设置”，填接口地址和家长密码，点“连接并同步”。等到明确显示“已同步”。
2. 点“复制 iPad 配对链接”，在 iPad Safari 打开。链接含权限钥匙，仅发送到自己设备。
3. 配对后再“分享 → 添加到主屏幕”。打开桌面图标，确认显示“已同步”。如安装后的存储与 Safari 分开，在桌面图标中“连接小册”粘贴同一链接再配对。
4. 添加一道测试题，在孩子端提交，再到电脑确认做对；回到孩子端联网刷新，确认不再抽到。

家长会话过期后重新输入家长密码；孩子配对过期后重新生成链接。更换 `SESSION_SECRET` 可使所有已有会话及配对失效。修改密码使用 `node configure.mjs --password-only`，请先重新登录再生成新配对链接。

## 备份、冲突与恢复

- 定期在家长端导出完整备份，单独存到自己的“文件”或电脑。GitHub 本身保留提交历史，但备份更便于换设备。
- 断网时仍能做本机已缓存的题，作答先入队；恢复网络会重试。不要因为看到“已保存本机”就清理浏览器。
- 两台家长设备同时改同一题，接口拒绝旧版本。先导出本机备份，再在同步设置用“使用云端记录”清理发生冲突的本机队列；需要保留的题可从备份中按新编号重新录入。
- 图像作为不可变内容文件存储，状态保存成功前上传中断可能留下暂未引用的图像，不会被孩子端读出。
- 如需删除私有仓库中所有历史照片，单纯在界面移到回收站不会清除 Git 历史，需要另外清理私有仓库历史或创建新的私有数据仓库。
