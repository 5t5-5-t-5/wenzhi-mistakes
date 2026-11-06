# 照片转可编辑电子题

此功能与“调亮照片”不同：图像识别提取原印刷题，排除手写作答、草稿、批改，再生成白底文字和可编辑矢量图。识别可能有误，文字、数字、单位、图中标签和数量应在保存前对照原图核对。无法可靠还原的内容会提示，不会自动猜答案。

## 网页怎么用

1. 拍照或导入 PDF，先裁剪到一道题，保存题图。
2. 点“一键去笔记，生成电子题”。题图经私有 GitHub 仓库交给后台识别，不会发到公开网页。
3. 在“题目内容”中修改文字、数字和符号；在“修改题图”里选中文字、物体，改标签、颜色、位置，或复制、删除一个物体。
4. 保存后孩子端和打印使用白底电子题。原照片仍在家长端，供核对或重新整理。

识别有等待时间；关闭页面前任务会留在本机识别草稿，之后可点“继续整理”。还没有开通识别服务时，可以先点“直接编辑电子题”，手动录入题干和图形，保存与打印照常可用。

## 开通后台（一次配置，不需要 Cloudflare）

后台部署在现有 GitHub 私有数据仓库的 Actions 中。需要：

- GitHub 授权允许安装工作流（`workflow` 权限）。这仅用于安装后台；iPad 日常的专用密钥仍只给 Contents 读写权限，不要给设备密钥增加 Workflows 写权限。
- 默认使用阿里云百炼北京地域的视觉模型。创建自己的百炼 API Key，添加到私有数据仓库的 Actions Secret：`DASHSCOPE_API_KEY`。调用会按所用API计费。

### 获取密钥（中国大陆用户）

1. 登录[百炼 API Key 页面](https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key)，按控制台要求开通服务，选择 **华北2（北京）**。
2. 点 **创建 API Key**，使用自己的账号和默认业务空间。如选择自定义模型权限，应允许 `qwen3-vl-plus`。创建成功时复制并妥善保存；新版密钥只完整显示一次。
3. 打开[私有数据仓库的新建 Secret 页面](https://github.com/5t5-5-t-5/wenzhi-mistakes-data/settings/secrets/actions/new)。Name 填 `DASHSCOPE_API_KEY`，Secret 填自己的百炼密钥，点 **Add secret**。不用发到聊天、网页表单或公开仓库。
4. 完成下面的工作流安装后，从 Actions 手动运行一次后台服务检查。服务检查只确认密钥已配置；还需用一张测试题图验证模型调用和识别效果。无密钥或识别失败时不会返回假结果。

这不是阿里云账号的 AccessKey，也不需要购买服务器。注册、实名认证、服务协议和付费开通请由账号本人完成。具体额度和费用以[百炼价格说明](https://help.aliyun.com/zh/model-studio/model-pricing)及自己的控制台为准。

### 安装 GitHub 后台

在有 GitHub CLI 的电脑、此项目文件夹中执行：

```sh
gh auth refresh -h github.com -s workflow
node recognition/install.mjs
```

默认安装百炼后台。然后在私有仓库 `wenzhi-mistakes-data` 的 **Settings → Secrets and variables → Actions** 中添加 `DASHSCOPE_API_KEY`，再从 Actions 手动运行 `Recognize a clean editable question` 做服务检查。

如果你明确希望把电脑环境里已有的 API 密钥配置到私有仓库 Secrets，可运行：

```sh
node recognition/install.mjs --use-env-key
```

这个参数会把所选服务商的已有环境密钥发送到 GitHub Secrets；默认读取 `DASHSCOPE_API_KEY`。请仅在确认密钥归属、可用于此应用时使用。密钥不会写进网页、备份、请求文件或终端输出。

仅当账号及使用地区符合 OpenAI 服务要求时，才可用 `node recognition/install.mjs --provider=openai` 安装 OpenAI 后台，对应 Secret 为 `OPENAI_API_KEY`、默认模型 `gpt-4.1`。[OpenAI 支持地区](https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories)目前不包括中国大陆；ChatGPT 订阅与 API 计费也互相独立。两家服务的密钥不会互相代用或自动回退。

## 权限与调用

日常设备只上传题图和识别请求。工作流使用固定提交的可信处理代码，不执行私有数据仓库中可被设备修改的脚本。AI密钥只用于调用所选服务商；题图也会发给该服务商处理，生成结果写回私有仓库。前端不能读取 Actions Secret。

默认模型为 `qwen3-vl-plus`，使用北京地域接口（官方仍支持的 `dashscope.aliyuncs.com` 域名），关闭思考并请求 JSON 结果。每次最多处理一道题；默认每天最多 30 次识别尝试（上海时间计日），可在后台工作流中调整。这是次数限制，不是金额上限；GitHub Actions 也受账号用量与计费规则限制。

手写内容是否属于答案、被盖住的文字、图形类别和数量仍可能判断错误，必须保留家长编辑核对步骤。源照片本来就没有记录清楚的信息，不能保证恢复。

依据：[百炼 API Key 说明](https://help.aliyun.com/zh/model-studio/get-api-key/)、[视觉接口](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai)、[JSON 模式](https://help.aliyun.com/zh/model-studio/qwen-structured-output)、[OpenAI 图像识别说明](https://developers.openai.com/api/docs/guides/images-vision)。此前合成题的 OpenAI 识别结果已验证；百炼实际效果须在用户密钥配置后单独实测，不能把其他模型的结果当作百炼的效果。
