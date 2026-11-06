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
- 使用 OpenAI 图像识别接口。需要你自己的、可正常调用的 OpenAI API 密钥，添加到私有数据仓库的 Actions Secret：`OPENAI_API_KEY`。调用按 API 用量计费。

### 获取 OpenAI 密钥

1. 登录 [OpenAI API 平台](https://platform.openai.com/)，按照控制台提示完成自己的 API 账号及计费设置。
2. 打开 [API Keys](https://platform.openai.com/api-keys)，创建专供错题本使用的密钥，并妥善保存。
3. 打开[私有数据仓库的新建 Secret 页面](https://github.com/5t5-5-t-5/wenzhi-mistakes-data/settings/secrets/actions/new)。Name 填 `OPENAI_API_KEY`，Secret 填自己的 OpenAI 密钥，点 **Add secret**。不用发到聊天、网页表单或公开仓库。
4. 完成下面的工作流安装后，从 Actions 手动运行一次后台服务检查。服务检查只确认密钥已配置；还需用一张测试题图验证模型调用和识别效果。无密钥或识别失败时不会返回假结果。

技术上支持接入不代表任何账号都能开通；API 的账号、使用地区和支付资格以 OpenAI 官方要求为准。若官网提示不支持地区或账号无法开通，不能靠修改网页代码解决，也不会自动换到别的服务商。参考 [OpenAI 入门文档](https://developers.openai.com/api/docs/quickstart)。

### 安装 GitHub 后台

在有 GitHub CLI 的电脑、此项目文件夹中执行：

```sh
gh auth refresh -h github.com -s workflow
node recognition/install.mjs
```

默认安装 OpenAI 后台。然后在私有仓库 `wenzhi-mistakes-data` 的 **Settings → Secrets and variables → Actions** 中添加 `OPENAI_API_KEY`，再从 Actions 手动运行 `Recognize a clean editable question` 做服务检查。

如果你明确希望把电脑环境里已有的 API 密钥配置到私有仓库 Secrets，可运行：

```sh
node recognition/install.mjs --use-env-key
```

这个参数会把当前环境的 `OPENAI_API_KEY` 发送到 GitHub Secrets。请仅在确认密钥归属、可用于此应用时使用；不会自动把电脑里已有的未知归属密钥部署上去。密钥不会写进网页、备份、请求文件或终端输出。

## 权限与调用

日常设备只上传题图和识别请求。工作流使用固定提交的可信处理代码，不执行私有数据仓库中可被设备修改的脚本。AI密钥只用于调用所选服务商；题图也会发给该服务商处理，生成结果写回私有仓库。前端不能读取 Actions Secret。

默认模型为 `gpt-4.1`，通过 OpenAI Responses API 读取题图，返回题干和可编辑矢量图。每次最多处理一道题；默认每天最多 30 次识别尝试（上海时间计日），可在后台工作流中调整。这是次数限制，不是金额上限；GitHub Actions 也受账号用量与计费规则限制。

手写内容是否属于答案、被盖住的文字、图形类别和数量仍可能判断错误，必须保留家长编辑核对步骤。源照片本来就没有记录清楚的信息，不能保证恢复。

依据：[OpenAI 图像识别说明](https://developers.openai.com/api/docs/guides/images-vision)。此前合成题的 OpenAI 识别结果已验证；正式私有后台仍需在自己的密钥配置后完成端到端验证。
