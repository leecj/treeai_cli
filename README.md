# TreeAI CLI

TreeAI CLI is a Node.js/TypeScript terminal tool that orchestrates multi-task Git worktree flows powered by AI assistants such as Claude and Codex.

Prefer the Chinese version? See [README.zh-CN.md](README.zh-CN.md).

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
- `switch`: switches to an existing worktree and launches the AI tool to continue working.
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

### `treeai switch`

- Lists all existing worktrees in the current repository for interactive selection.
- Automatically launches the AI tool in the selected worktree directory (default `claude`).
- Supports `--repo` to specify repository, `--tool` to specify tool, and `--tool-arg` for extra parameters.
- Use `--skip-launch` to only display the worktree path without launching the tool.
- Perfect for quickly switching between multiple ongoing tasks without recreating worktrees.

### `treeai finish [taskName]`

- Detects the current worktree or lets you choose from history.
- By default performs: checkout base branch, delete worktree directory, delete merged branch.
- Multi-select prompts let you adjust cleanup actions; `--keep-branch` and `--no-cleanup` tweak defaults.
- Warns when uncommitted changes are present; `--force` skips confirmation.
- Summaries explain the underlying Git operations so you know exactly what happens.

### `treeai status`

- Shows default repository, AI tool configuration, recent task list, and worktree status.

## Supported AI Tools

TreeAI CLI comes with pre-configured support for multiple AI coding assistants:

- **Claude Code** - Anthropic's official CLI
- **Codex** - Using gpt-5-codex model with reasoning
- **Happy** - [Happy Coder](https://github.com/slopus/happy) - An agentic AI pair programmer
- **Happy Codex** - Happy with gpt-5-codex configuration

You can specify which tool to use with the `--tool` flag:

```bash
treeai start feature/login --tool happy
treeai switch --tool happy_codex
```

## Configuration

- Stored at `~/.config/treeai/config.json`.
- Supports default repository, recent repositories, AI tool presets, permission mode, and task history.
- `start` / `finish` keep the configuration in sync; a dedicated `treeai config` subcommand is planned.

## Roadmap

- Expand the `worktrees` and `branches` subcommands to reach feature parity with the original Python CLI.
- Provide migration helpers and command aliases for teams moving from the Python version.
- Add unit and integration tests (Vitest + execa).
- Ship both the npm package and a standalone executable bundle.
