# TreeAI CLI

TreeAI CLI 是基于 Node.js/TypeScript 的终端工具，可快速编排 Claude、Codex 等 AI 助手的多任务 Git worktree 工作流。
## 快速开始

```bash
# 安装依赖
pnpm install

# 本地开发调试
pnpm dev -- start feature/login

# 构建产物
pnpm build
```

> TreeAI CLI 最低要求 Node.js 20。

## 核心命令

### `treeai start [任务名]`
- 自动解析 Git 仓库（可通过 `--repo` 指定）。
- 智能生成分支名与工作树目录，默认落在 `~/.treeai/<repo>/<task>`。
- 支持自定义基础分支 `--base` 与工作树目录 `--worktree`。
- 自动读取历史任务并提供一键选择。
- 创建完成后会按配置启动默认的 AI 工具（默认 `claude`，带 `--dangerously-skip-permissions`）。
- 任务名称会直接用于分支命名（支持中文等字符），便于后续识别。
- 可使用 `--skip-launch` 跳过启动，或 `--tool`/`--tool-arg` 指定其他工具。

### `treeai finish [任务名]`
- 自动检测当前工作树，或通过历史列表选择目标任务。
- 默认执行三步组合动作：切回基础分支、删除工作树目录、删除已合并分支。
- 通过多选列表可调整清理动作；`--keep-branch` / `--no-cleanup` 控制默认选项。
- 检测到未提交改动时会提示确认，支持 `--force` 跳过。
- 提示会说明各个选项代表的实际操作流程，方便快速确认。

### `treeai status`
- 查看默认仓库、AI 工具配置、最近任务列表与当前工作树情况。

## 配置说明
- 配置文件存放于 `~/.config/treeai/config.json`。
- 结构支持默认仓库、最近仓库列表、AI 工具预设、权限模式与历史任务记录。
- 通过 `start` / `finish` 命令会自动更新配置；后续版本将提供显式的 `treeai config` 子命令。

## 下一步计划
- 丰富 `worktrees` 和 `branches` 子命令，补齐 ManyAI CLI 的完整功能面。
- 提供配置迁移与命令别名，辅助从 Python 版本切换。
- 引入单元测试与集成测试（基于 Vitest + execa）。
- 打包发布到 npm，并提供独立的可执行文件。
