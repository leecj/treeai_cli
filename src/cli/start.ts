import path from 'node:path';
import { Command } from 'commander';
import { loadConfig, recordTaskHistory, saveConfig, updateRecentRepos } from '../services/config.js';
import {
  createWorktree,
  detectDefaultBaseBranch,
  findWorktreeByBranch,
  getRepo
} from '../services/git.js';
import {
  computeWorktreePath,
  ensureWorktreeParent,
  isDirectoryEmpty,
  pathExists,
  removeDirectory
} from '../services/worktree.js';
import { logger } from '../utils/logger.js';
import { generateTaskId, normalizeTaskName, toBranchName } from '../utils/task.js';
import {
  promptConfirm,
  promptForBaseBranch,
  promptForRepo,
  promptTaskFromHistory,
  promptForTaskName
} from '../ui/prompts.js';
import { launchTool } from '../services/tools.js';
import type { PermissionMode } from '../types/index.js';

interface StartOptions {
  repo?: string;
  base?: string;
  worktreePath?: string;
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

export const registerStartCommand = (program: Command): void => {
  program
    .command('start')
    .argument('[taskName]', '任务名称，将用于生成分支与工作树名')
    .description('创建工作树并启动默认 AI 工具')
    .option('--repo <path>', '指定 Git 仓库路径')
    .option('-b, --base <branch>', '指定基础分支')
    .option('--worktree <path>', '自定义工作树目录')
    .option('--tool <name>', '指定启动的 AI 工具名称')
    .option('--tool-arg <arg>', '额外传递给 AI 工具的参数，可重复使用', collectToolArgs, [])
    .option('--permission-mode <mode>', '权限模式，如 acceptEdits / bypassPermissions')
    .option('--yes', '跳过所有确认提示', false)
    .option('--non-interactive', '非交互模式，缺失信息时报错', false)
    .option('--skip-launch', '创建后不启动 AI 工具', false)
    .action(async (taskName: string | undefined, options: StartOptions) => {
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
      const branches = await git.branchLocal();

      const defaultBase = options.base ?? (await detectDefaultBaseBranch(git));
      const baseBranch = options.base
        ? options.base
        : nonInteractive
          ? defaultBase
          : await promptForBaseBranch(branches.all, defaultBase);

      let providedTask = taskName;

      if (!providedTask && !nonInteractive) {
        const historyChoice = await promptTaskFromHistory(
          config.history.tasks.filter((task) => task.repo === repoPath)
        );
        if (historyChoice) {
          providedTask = historyChoice;
        }
      }

      if (!providedTask) {
        providedTask = nonInteractive ? generateTaskId() : await promptForTaskName();
      }

      const normalizedTask = normalizeTaskName(providedTask);
      const branchName = toBranchName(normalizedTask);
      const worktreePath = computeWorktreePath(config, repoPath, branchName, options.worktreePath);

      const existingWorktree = await findWorktreeByBranch(git, branchName);

      if (existingWorktree) {
        logger.warn('分支 %s 已存在工作树：%s', branchName, existingWorktree.path);
        if (!nonInteractive) {
          const reuse = await promptConfirm('是否直接使用已有工作树?', true);
          if (!reuse) {
            throw new Error('操作已取消。');
          }
        }
        logger.info('工作树目录：%s', existingWorktree.path);
        if (!options.skipLaunch) {
          await launchTool(config, {
            toolName: options.tool,
            permissionMode: options.permissionMode,
            extraArgs: options.toolArg,
            workingDirectory: existingWorktree.path
          });
        } else {
          logger.info('已跳过 AI 工具启动，工作树路径：%s', existingWorktree.path);
        }
        logger.raw('完成后可执行：treeai finish %s', normalizedTask);
        return;
      }

      if (await pathExists(worktreePath)) {
        if (await isDirectoryEmpty(worktreePath)) {
          logger.warn('目标目录 %s 已存在，将直接复用。', worktreePath);
        } else {
          if (nonInteractive) {
            throw new Error(`目标目录已存在且非空：${worktreePath}`);
          }
          const remove = await promptConfirm(`目录 ${worktreePath} 已存在，是否删除后继续？`, false);
          if (!remove) {
            throw new Error('操作已取消。');
          }
          await removeDirectory(worktreePath);
        }
      }

      await ensureWorktreeParent(worktreePath);

      logger.info('正在创建分支 %s 基于 %s ...', branchName, baseBranch);
      await createWorktree(git, branchName, worktreePath, baseBranch);
      logger.success('工作树已创建：%s', worktreePath);
      logger.info('分支名称：%s', branchName);

      const updatedConfig = recordTaskHistory(
        updateRecentRepos(
          {
            ...config,
            defaultRepo: repoPath
          },
          repoPath
        ),
        {
          name: normalizedTask,
          branch: branchName,
          repo: repoPath,
          worktreePath
        }
      );

      await saveConfig(updatedConfig);

      if (!options.skipLaunch) {
        await launchTool(updatedConfig, {
          toolName: options.tool,
          permissionMode: options.permissionMode,
          extraArgs: options.toolArg,
          workingDirectory: worktreePath
        });
        logger.info('已在 %s 中启动 AI 工具，结束后 Ctrl+C 返回即可。', worktreePath);
      } else {
        logger.info('已跳过 AI 工具启动。');
        logger.info('可以执行：cd %s', worktreePath);
      }

      logger.raw('完成后可执行：treeai finish %s', normalizedTask);
    });
};
