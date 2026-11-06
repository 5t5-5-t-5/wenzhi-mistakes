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
- 一个可用的 OpenAI API 密钥，添加到私有数据仓库的 Actions Secret：`OPENAI_API_KEY`。调用会按所用API计费。

在有 GitHub CLI 的电脑、此项目文件夹中执行：

```sh
gh auth refresh -h github.com -s workflow
node recognition/install.mjs
```

然后在私有仓库 `wenzhi-mistakes-data` 的 **Settings → Secrets and variables → Actions** 中添加 `OPENAI_API_KEY`，再从 Actions 手动运行 `Recognize a clean editable question` 做服务检查。

如果你明确希望把电脑环境里已有的 API 密钥配置到私有仓库 Secrets，可运行：

```sh
node recognition/install.mjs --use-env-key
```

这个参数会把已有环境密钥发送到 GitHub Secrets；请仅在确认密钥归属、可用于此应用时使用。密钥不会写进网页、备份、请求文件或终端输出。

## 权限与调用

日常设备只上传题图和识别请求。工作流使用固定提交的可信处理代码，不执行私有数据仓库中可被设备修改的脚本。AI密钥只用于调用 OpenAI，生成结果写回私有仓库。前端不能读取 Actions Secret。

默认模型为 `gpt-4.1`，每次最多处理一道题；默认每天最多 30 次识别尝试（上海时间计日），可在后台工作流中调整。手写内容是否属于答案、被盖住的文字、图形类别和数量仍可能判断错误，必须保留家长编辑核对步骤。源照片本来就没有记录清楚的信息，不能保证恢复。

依据：[OpenAI 官方图像识别说明](https://developers.openai.com/api/docs/guides/images-vision)。图像识别有数字、文字、颜色、空间关系与计数方面的局限，不能保证原图不清楚的内容能准确恢复。
