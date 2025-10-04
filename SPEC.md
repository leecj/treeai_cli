# TreeAI CLI 规格说明

## 1. 项目背景
- **参考项目**：基于现有 `manyai_cli`（Python）项目的功能与流程，但重写为 Node.js/TypeScript 终端应用。
- **重命名**：新项目命名为 `treeai`，旨在凸显「分支/工作树」管理能力与树状结构管理的联想。
- **目标用户**：在终端中频繁创建 Git worktree 并配合 Claude、Codex 等 AI IDE 工具开展多任务协作的开发者。

## 2. 产品目标
1. 复刻并优化 ManyAI CLI 的核心能力（start、finish、worktree 与分支管理、AI 工具启动）。
2. 引入更高自动化程度，尤其是 `start` 与 `finish` 命令，减少用户手动输入次数与确认步骤。
3. 围绕 Claude、Codex 等 AI 工具构建高效的多任务切换与上下文管理能力。
4. 提供一致的「选择式」交互体验，关键操作可通过单次选择完成。
5. 与 Node.js 生态兼容：扩展能力、发布到 npm、易于安装与维护。

## 3. 功能范围
### 3.1 基础命令
| 命令 | 说明 | 自动化增强 |
| ---- | ---- | ---------- |
| `treeai start <任务名>` | 创建/切换工作树、分支，自动启动 AI IDE | 引导式对话：默认读取最近项目；必要信息通过选项选择；支持一键默认执行 |
| `treeai finish [任务名]` | 清理工作树、分支并回到主分支 | 支持自动检索当前工作树；提供预设动作组合（清理 + 提交 + 推送）的一键执行 |
| `treeai status` | 显示默认仓库、当前工作树状态 | 行为兼容 ManyAI；新增“最近任务”列表 |
| `treeai worktrees list` | 列出工作树 | 增加颜色/图标显示状态 |
| `treeai worktrees add` / `remove` | 创建/删除工作树 | 选项与 ManyAI 一致 |
| `treeai branches list` | 列出未被占用分支 | 增加过滤/排序选项 |
| `treeai tools codex|happy|claude` | 启动 AI 工具 | 自动补充默认参数；支持从配置中读取常用参数集 |
| `treeai config` | 查看/修改配置 | 交互式配置编辑（如默认 AI 工具参数、权限模式等） |

### 3.2 非功能性需求
- **平台支持**：macOS、Linux（优先 zsh/bash）。
- **Node.js 版本**：支持 LTS (>= 20.x)。
- **包管理**：使用 pnpm 作为开发默认；发布时提供 npm/yarn 兼容安装方法。
- **日志与调试**：`DEBUG=treeai:*` 环境变量开启详细日志。
- **国际化**：首版提供中文输出，内部代码采用英文命名，后续预留 i18n 接口。

## 4. 交互设计
### 4.1 全局交互原则
- 首选「一步确认」：在信息完整时直接执行，无需再次确认。
- 信息不足时提供选择列表（使用 `@inquirer/prompts` 等库），默认选项为推荐路径。
- 通过彩色输出提示成功/警告/错误。

### 4.2 `treeai start` 流程
1. **自动检测仓库**：
   - 默认定位为当前目录或配置中记住的仓库路径。
   - 若多仓库候选，展示最近使用列表让用户选择。
2. **分支/任务名处理**：
   - 接收 `<任务名>`；未提供时触发“选择最近任务”面板。
   - 自动归一化任务名（替换空格、中文等）。
3. **分支检查与创建**：
   - 若分支不存在，提示选择从 `main`/`develop`/当前分支等来源创建；默认选 `main`。
   - 自动创建工作树目录到 `~/.treeai/<repo>/<task>`。
4. **权限与 AI 工具启动**：
   - 读取配置中的默认 AI 工具与参数，默认启用 `--dangerously-skip-permissions`。
   - 如用户希望调整，提供快速选择预设（如 `strict`, `acceptEdits`）。
5. **终端会话管理**：
   - 提供选项决定是否在当前 shell 打开 `claude-code`, `codex`, `happy` 等；默认仅显示路径并提醒命令。
6. **最终确认输出**：
   - 输出创建的分支、工作树路径、执行命令摘要。

### 4.3 `treeai finish` 流程
1. **任务选择**：
   - 若传入 `<任务名>`，直接使用；否则自动匹配当前工作树或弹出列表供选择。
2. **状态检查**：
   - 检测工作树是否干净、分支是否已合并。
   - 提供“一键完成”选项：`[√] 切回主分支`、`[√] 删除工作树目录`、`[√] 删除本地分支（若已合并）`、`[ ] 保留分支`。
   - 默认选择根据检测结果预填，例如分支已合并 -> 勾选删除。
3. **自动执行**：
   - 依次执行选定操作，并在失败时提供恢复建议。
4. **结束提示**：
   - 输出清理结果、遗留步骤（如远程分支未删除）。

### 4.4 交互细节
- **选择器组件**：统一使用列表或复选框，支持数字快捷键。
- **历史记忆**：`start` 与 `finish` 记录最近 5 个任务，便于快速选择。
- **无交互模式**：提供 `--yes` / `--no-interactive`，用于脚本化场景。

## 5. 技术架构
### 5.1 模块划分
- `cli/`：命令定义与解析（基于 `commander` 或 `oclif`）。
- `services/git.ts`：Git 交互封装（使用 `simple-git` 或直接调用 `git`）。
- `services/worktree.ts`：工作树管理逻辑。
- `services/config.ts`：配置读写（默认 `~/.config/treeai/config.json`）。
- `services/tools.ts`：AI 工具启动器（shell 命令封装）。
- `ui/prompts.ts`：统一的交互层，封装 inquirer 调用与默认值。
- `utils/logger.ts`：彩色输出与调试日志。

### 5.2 配置文件结构
```jsonc
{
  "defaultRepo": "/path/to/repo",
  "recentRepos": ["/path/one", "/path/two"],
  "defaultPermissionMode": "bypassPermissions",
  "defaultAiTool": "claude",
  "toolPresets": {
    "claude": {
      "executable": "claude",
      "args": ["--dangerously-skip-permissions"]
    },
    "codex": {"executable": "codexh", "args": []}
  },
  "history": {
    "tasks": [
      {"name": "feature/login", "repo": "/path/repo", "lastUsed": "2025-09-28T08:21:00Z"}
    ]
  }
}
```

### 5.3 依赖库候选
- CLI 框架：`commander`（轻量）或 `oclif`（插件体系）。首版建议 `commander` + 自建命令目录结构。
- 交互：`@inquirer/prompts`（Esm@node18+ 支持）或 `enquirer`。
- Git 操作：`simple-git`；需要时 fallback 到原生命令。
- 日志与颜色：`chalk`、`debug`。
- 测试：`vitest` + `tsx` 运行单元测试；集成测试使用 `execa` 模拟命令执行。

## 6. 数据流与状态管理
- 命令入口解析参数 ->
- 调用 `configService` 读取默认配置与历史任务 ->
- `promptService` 根据上下文（参数、配置、Git 状态）决定是否需要交互 ->
- `gitService` 执行具体操作（创建分支/工作树等） ->
- `toolService` 根据选项启动 AI 工具 ->
- 输出统一的 `ActionSummary`（JSON + 可读文本），便于后续扩展 API。

## 7. 错误处理与恢复
- **分支已存在**：提示是否直接切换并重用现有工作树。
- **工作树目录存在但非空**：提示是否清理/重用。
- **Git 工作树命令不支持**：检测 `git` 版本 < 2.37 时提示升级。
- **权限问题**：提供指引（如 macOS 需授予终端访问磁盘）。
- **外部工具未安装**：明确输出缺失命令与安装建议。

## 8. 日志与可观测性
- 默认输出核心步骤。
- `--json` 选项输出结构化结果，便于脚本集成。
- `DEBUG=treeai:* treeai start ...` 打印详细信息（命令执行、git 返回值）。
- 异常使用统一错误码：`E_GIT_*`, `E_CONFIG_*`, `E_TOOL_*`。

## 9. 发布与部署
- **开发环境**：`pnpm dev` 运行 CLI（使用 `tsx` 监听）。
- **打包**：使用 `pkg` 或 `ncc` 产出单文件可执行，发布附带 npm 包。
- **版本发布流程**：语义化版本；使用 `changesets` 管理。
- **CI**：GitHub Actions（Node LTS matrix）执行 lint、test、发布。

## 10. 向后兼容与迁移
- 提供 `manyai_cli` -> `treeai` 的迁移指南：
  - 配置文件迁移脚本：检测 `~/.config/manyai-cli/config.json` -> 生成新配置。
  - 提供 `treeai import manyai` 命令辅助迁移。
- 保留 CLI 命令别名 `manyai`（可选，通过 `treeai alias manyai`）。

## 11. 未决事项（TBD）
1. AI 工具启动器是否需要支持自定义环境变量模板？
2. `finish` 是否默认执行 `git status` 并提醒未推送提交？
3. 是否集成 task management（如 Jira、Linear）自动命名？
4. 工作树目录是否允许自定义根目录（默认 `~/.treeai`）。
5. 国际化策略与英文版命令输出的时间表。

## 12. 里程碑规划
1. **M0 规格确认**：2025-10-02 完成规格文档并评审。
2. **M1 CLI 骨架**：完成命令解析、配置管理、基础 `start/finish` 流程原型。
3. **M2 自动化增强**：引入交互式选择、历史记录、AI 工具预设。
4. **M3 发布 Beta**：完成测试、文档、npm 发布与迁移指引。
5. **M4 正式版**：根据反馈迭代，稳定 API。
