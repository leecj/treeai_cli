# TreeAI CLI 中文说明

[English Version](README.md)

TreeAI CLI 是基于 Node.js/TypeScript 的终端工具，可快速编排 Claude、Codex 等 AI 助手的多任务 Git worktree 工作流。

## 快速开始

```bash
# 全局安装（一次即可）
npm install -g treeai

# 1. 创建任务工作流
treeai start feature/login

# 2. 收尾清理
treeai finish feature/login

# 需要时可以用 npx 即开即用
npx treeai start bugfix/session-timeout
```

- `start`：检测当前仓库，创建/切换分支与工作树，并按配置启动 AI 工具。
- `switch`：切换到已存在的工作树，并启动 AI 工具继续工作。
- `finish`：回到基础分支、清理工作树目录，并按提示删除或保留已合并分支。
- 任意命令都可加 `--help` 查看可用选项，例如 `treeai start --help`。

> TreeAI CLI 最低要求 Node.js 20。

## 本地开发（可选）

仅在参与 CLI 开发或调试时执行：

```bash
pnpm install
pnpm dev -- start feature/login
pnpm build
```

- `npm run dev --tool codex` 等价于 `npm run dev -- --tool codex`，可直接在当前目录使用指定 AI 工具（运行时 npm 可能提示警告，可忽略）。

## 核心命令

### `treeai start [任务名]`

- 直接执行 `treeai` 等同于 `treeai start`，默认在当前目录快速启动 AI 工具（不创建工作树）。
- 通过 `--no-reuse-current` 可禁用自动复用逻辑，进入工作树创建流程。
- 自动解析 Git 仓库（可通过 `--repo` 指定）。
- 智能生成分支名与工作树目录（默认 `~/.treeai/<repo>/<task>`）。
- 支持自定义基础分支 `--base` 与工作树目录 `--worktree`。
- 自动读取历史任务并提供一键选择。
- 创建完成后会按配置启动默认的 AI 工具（默认 `claude`，带 `--dangerously-skip-permissions`）。
- 任务名称直接用于分支命名（支持中文等字符），便于识别。
- 可使用 `--skip-launch`、`--tool`、`--tool-arg` 控制 AI 工具启动行为。
- 使用 `--reuse-current` 可显式复用当前目录（若已禁用自动复用）。

### `treeai switch`

- 列出当前仓库下所有已存在的工作树，交互式选择要切换的工作树。
- 自动在选定的工作树目录中启动 AI 工具（默认 `claude`）。
- 支持 `--repo` 指定仓库，`--tool` 指定工具，`--tool-arg` 传递额外参数。
- 可使用 `--skip-launch` 仅显示工作树路径而不启动工具。
- 适用于在多个任务之间快速切换，无需重新创建工作树。

### `treeai finish [任务名]`

- 自动检测当前工作树，或从历史列表中选择目标任务。
- 默认执行三步组合：切回基础分支、删除工作树目录、删除已合并分支。
- 通过多选列表可调整清理动作；`--keep-branch` / `--no-cleanup` 控制默认选项。
- 检测到未提交改动时会提示确认，可用 `--force` 跳过。
- 输出会说明各个选项对应的 Git 操作，方便快速确认。

### `treeai status`

- 查看默认仓库、AI 工具配置、最近任务列表与当前工作树状态。

## 支持的 AI 工具

TreeAI CLI 内置了多个 AI 编程助手的预配置支持：

- **Claude Code** - Anthropic 官方 CLI
- **Codex** - 使用 gpt-5-codex 模型，支持推理
- **Happy** - [Happy Coder](https://github.com/slopus/happy) - 智能 AI 结对编程助手
- **Happy Codex** - Happy 配合 gpt-5-codex 的配置

可以通过 `--tool` 参数指定使用的工具：

```bash
treeai start feature/login --tool happy
treeai switch --tool happy_codex
```

## 配置说明

- 配置文件位于 `~/.config/treeai/config.json`。
- 支持默认仓库、最近仓库列表、AI 工具预设、权限模式与历史任务记录。
- `start` / `finish` 会自动更新配置；后续将提供显式的 `treeai config` 子命令。

## 下一步计划

- 丰富 `worktrees` 和 `branches` 子命令，补齐 ManyAI CLI 的完整功能面。
- 提供配置迁移与命令别名，辅助从 Python 版本切换。
- 引入单元测试与集成测试（基于 Vitest + execa）。
- 打包发布到 npm，并提供独立的可执行文件。
