# TreeAI CLI

TreeAI CLI is a Node.js/TypeScript terminal tool that orchestrates multi-task Git worktree flows powered by AI assistants such as Claude and Codex.

## Quick Start

```bash
# Install once globally
npm install -g treeai

# 1. Start a task workspace
treeai start feature/login

# 2. Wrap up when you're done
treeai finish feature/login

# Prefer not to install globally? Use npx on demand
npx treeai start bugfix/session-timeout
```

- `start`: detects the current repository, creates/switches the branch and worktree, then launches the configured AI tool.
- `finish`: returns to the base branch, cleans up the worktree directory, and offers to delete the merged branch.
- Append `--help` to any command (for example `treeai start --help`) to inspect available flags.

> TreeAI CLI requires Node.js 20 or newer.

### Local Development (optional)

Only needed when contributing to or debugging the CLI itself:

```bash
pnpm install
pnpm dev -- start feature/login
pnpm build
```

## Core Commands

### `treeai start [taskName]`
- Automatically resolves the Git repository (override via `--repo`).
- Generates branch and worktree names, defaulting to `~/.treeai/<repo>/<task>`.
- Supports custom base branch `--base` and worktree directory `--worktree`.
- Loads recent tasks for one-shot selection.
- Launches the configured AI tool by default (default `claude` with `--dangerously-skip-permissions`).
- Uses the task name directly as the branch name (Unicode-friendly) for easy recognition.
- Use `--skip-launch`, `--tool`, or `--tool-arg` to control AI launch behavior.

### `treeai finish [taskName]`
- Detects the current worktree or lets you choose from history.
- By default performs: checkout base branch, delete worktree directory, delete merged branch.
- Multi-select prompts let you adjust cleanup actions; `--keep-branch` and `--no-cleanup` tweak defaults.
- Warns when uncommitted changes are present; `--force` skips confirmation.
- Summaries explain the underlying Git operations so you know exactly what happens.

### `treeai status`
- Shows default repository, AI tool configuration, recent task list, and worktree status.

## Configuration
- Stored at `~/.config/treeai/config.json`.
- Supports default repository, recent repositories, AI tool presets, permission mode, and task history.
- `start` / `finish` keep the configuration in sync; a dedicated `treeai config` subcommand is planned.

## Roadmap
- Expand the `worktrees` and `branches` subcommands to reach feature parity with the original Python CLI.
- Provide migration helpers and command aliases for teams moving from the Python version.
- Add unit and integration tests (Vitest + execa).
- Ship both the npm package and a standalone executable bundle.

---

## 中文说明

TreeAI CLI 是基于 Node.js/TypeScript 的终端工具，可快速编排 Claude、Codex 等 AI 助手的多任务 Git worktree 工作流。

### 快速开始

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
- `finish`：回到基础分支、清理工作树目录，并按提示删除或保留已合并分支。
- 任意命令都可加 `--help` 查看可用选项，例如 `treeai start --help`。

> TreeAI CLI 最低要求 Node.js 20。

### 本地开发（可选）

仅在参与 CLI 开发或调试时执行：

```bash
pnpm install
pnpm dev -- start feature/login
pnpm build
```

### 核心命令

#### `treeai start [任务名]`
- 自动解析 Git 仓库（可通过 `--repo` 指定）。
- 智能生成分支名与工作树目录（默认 `~/.treeai/<repo>/<task>`）。
- 支持自定义基础分支 `--base` 与工作树目录 `--worktree`。
- 自动读取历史任务并提供一键选择。
- 创建完成后会按配置启动默认的 AI 工具（默认 `claude`，带 `--dangerously-skip-permissions`）。
- 任务名称直接用于分支命名（支持中文等字符），便于识别。
- 可使用 `--skip-launch`、`--tool`、`--tool-arg` 控制 AI 工具启动行为。

#### `treeai finish [任务名]`
- 自动检测当前工作树，或从历史列表中选择目标任务。
- 默认执行三步组合：切回基础分支、删除工作树目录、删除已合并分支。
- 通过多选列表可调整清理动作；`--keep-branch` / `--no-cleanup` 控制默认选项。
- 检测到未提交改动时会提示确认，可用 `--force` 跳过。
- 输出会说明各个选项对应的 Git 操作，方便快速确认。

#### `treeai status`
- 查看默认仓库、AI 工具配置、最近任务列表与当前工作树状态。

### 配置说明
- 配置文件位于 `~/.config/treeai/config.json`。
- 支持默认仓库、最近仓库列表、AI 工具预设、权限模式与历史任务记录。
- `start` / `finish` 会自动更新配置；后续将提供显式的 `treeai config` 子命令。

### 下一步计划
- 丰富 `worktrees` 和 `branches` 子命令，补齐 ManyAI CLI 的完整功能面。
- 提供配置迁移与命令别名，辅助从 Python 版本切换。
- 引入单元测试与集成测试（基于 Vitest + execa）。
- 打包发布到 npm，并提供独立的可执行文件。
