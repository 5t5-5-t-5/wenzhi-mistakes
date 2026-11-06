# 不用 Cloudflare，直接用 GitHub 同步

不需要额外注册账号或部署服务器。网页、错题和作答记录都使用现有 GitHub 账号；错题和照片保存在专用的**私有仓库**。

## 只需配置一次

1. 在电脑打开[家长端](https://5t5-5-t-5.github.io/wenzhi-mistakes/parent.html)，点“同步设置”，连接方式选“直接连接 GitHub”。
2. 点击[创建专用密钥](https://github.com/settings/personal-access-tokens/new?name=Wenzhi+Notebook&target_name=5t5-5-t-5&expires_in=365&contents=write)。名称、有效期和 Contents 读写权限已预填。Repository access 选择 **Only select repositories**，只勾选 **wenzhi-mistakes-data**，再点 Generate token。
3. 将生成的 `github_pat_` 开头的密钥粘贴到**网页自己的密钥输入框**，设一个至少 8 位的家长密码，点“连接并同步”。等到显示“已同步”。不要把密钥发到聊天或放进公开源码。
4. 家长密码仍在输入框时，点“生成 iPad 配对链接”。把链接传到自己的 iPad，用 Safari 打开，输入刚才的家长密码完成配对，再“分享 → 添加到主屏幕”。如桌面 Web App 与 Safari 存储分开，在桌面图标中“连接小册”粘贴同一链接并输入密码。

如果旧设备已存有题目或作答，配对前先在旧设备的家长端导出备份，并在主家长端导入，避免把原来的本机记录留在旧存储中。

以后正常打开即可同步，不用每次复制密钥。家长端同步解锁会话 12 小时有效，到期重新输入家长密码；专用 GitHub 密钥到期或被撤销时需更新，并重新生成配对链接。若换成另一个浏览器或新设备，也需要连接或配对。

## 日常使用

- 家长在电脑收题，iPad 联网后读取同一份题目。
- 孩子一次只看一道题，可以只打印当前这一题，完成后交给家长确认。
- 家长确认做对后退出轮转；记录同步后，另一设备也不会再次抽到。
- 断网时操作先保存在本机。恢复网络后自动补传，收到 GitHub 确认才显示“已同步”。如果 GitHub 暂时连接不上，界面会显示“待同步”，不要清理浏览器数据。

## 权限和保存方式

这是一种家庭设备直连方案。专用密钥保存在家长配置的设备及已配对的 iPad 中，**不写入公开网页或错题备份**。配对链接使用 PBKDF2 与 AES-GCM 加密，其中没有明文密钥。

家长密码用于网页操作确认，不是服务器权限隔离。两端设备持有同一个私有仓库的读写权限；懂技术的人拿到该设备密钥后可以通过 GitHub API 访问全部错题数据，包括答案。因此只在自己管理的家庭设备上配对。需要严格区分角色时，仍可选用[独立同步接口](sync/SETUP.md)，这个选项不是必需的。

撤销 GitHub 专用密钥会使所有使用它的设备停止同步。更换家长密码本身不会撤销 GitHub 密钥或已配对设备。更换设备、清理浏览器前，先导出完整错题备份。忘记家长密码时，可保留本机备份并重新配置专用仓库，不会通过聊天索要密码。

接口依据：[GitHub 官方跨域请求说明](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)、[专用密钥设置说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。
