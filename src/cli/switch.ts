import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../services/config.js';
import { getRepo, listWorktrees } from '../services/git.js';
import { logger } from '../utils/logger.js';
import { promptForRepo, promptSelectWorktree } from '../ui/prompts.js';
import { launchTool } from '../services/tools.js';
import type { PermissionMode } from '../types/index.js';

interface SwitchOptions {
  repo?: string;
  tool?: string;
  toolArg?: string[];
  permissionMode?: PermissionMode;
  yes?: boolean;
  nonInteractive?: boolean;
  skipLaunch?: boolean;
}

const collectToolArgs = (value: string, previous: string[] = []): string[] => {
  if (!value) {
    return previous;
  }
  return [...previous, value];
};

export const registerSwitchCommand = (program: Command): void => {
  program
    .command('switch')
    .description('切换到已存在的工作树并启动 AI 工具')
    .option('--repo <path>', '指定 Git 仓库路径')
    .option('--tool <name>', '指定启动的 AI 工具名称')
    .option('--tool-arg <arg>', '额外传递给 AI 工具的参数，可重复使用', collectToolArgs, [])
    .option('--permission-mode <mode>', '权限模式，如 acceptEdits / bypassPermissions')
    .option('--yes', '跳过所有确认提示', false)
    .option('--non-interactive', '非交互模式，缺失信息时报错', false)
    .option('--skip-launch', '不启动 AI 工具，仅显示工作树路径', false)
    .action(async (options: SwitchOptions) => {
      const nonInteractive = options.nonInteractive || options.yes;
      const config = await loadConfig();

      let repoPath: string | undefined;

      if (options.repo) {
        repoPath = path.resolve(options.repo);
      } else {
        // 优先检测当前目录
        const detected = await getRepo(process.cwd()).catch(() => null);
        if (detected) {
          repoPath = detected.repoPath;
        } else {
          // fallback到配置中的默认仓库
          repoPath = config.defaultRepo;
        }
      }

      if (!repoPath) {
        if (nonInteractive) {
          throw new Error('无法确定 Git 仓库路径，请使用 --repo 指定。');
        }
        const selected = await promptForRepo({
          recentRepos: config.recentRepos,
          defaultRepo: config.defaultRepo
        });
        if (!selected) {
          throw new Error('未选择仓库。');
        }
        repoPath = selected;
      }

      const { git, repoPath: resolvedRepo } = await getRepo(repoPath);
      repoPath = resolvedRepo;

      const allWorktrees = await listWorktrees(git);

      // 过滤掉主仓库（bare 或者是 repoPath 本身）
      const worktrees = allWorktrees.filter((wt) => {
        if (wt.isBare) return false;
        const resolvedPath = path.resolve(wt.path);
        const resolvedRepoPath = path.resolve(repoPath);
        return resolvedPath !== resolvedRepoPath;
      });

      if (worktrees.length === 0) {
        logger.warn('当前仓库没有可用的工作树，请先使用 treeai start 创建。');
        return;
      }

      let selectedWorktreePath: string;

      if (nonInteractive) {
        // 非交互模式下，默认选择第一个
        selectedWorktreePath = worktrees[0].path;
      } else {
        const choices = worktrees.map((wt) => ({
          label: `${wt.branch ?? 'detached'} - ${wt.path}`,
          value: wt.path
        }));
        selectedWorktreePath = await promptSelectWorktree(choices, '选择要切换的工作树');
      }

      const selectedWorktree = worktrees.find((wt) => wt.path === selectedWorktreePath);

      if (!selectedWorktree) {
        throw new Error('未找到选择的工作树。');
      }

      logger.info('工作树路径：%s', selectedWorktree.path);
      logger.info('分支名称：%s', selectedWorktree.branch ?? 'detached');

      if (!options.skipLaunch) {
        await launchTool(config, {
          toolName: options.tool,
          permissionMode: options.permissionMode,
          extraArgs: options.toolArg,
          workingDirectory: selectedWorktree.path
        });
        logger.info('已在 %s 中启动 AI 工具，结束后 Ctrl+C 返回即可。', selectedWorktree.path);
      } else {
        logger.info('已跳过 AI 工具启动。');
        logger.info('可以执行：cd %s', selectedWorktree.path);
      }

      if (selectedWorktree.branch) {
        logger.raw('完成后可执行：treeai finish %s', selectedWorktree.branch);
      }
    });
};
