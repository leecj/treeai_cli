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

interface NpmArgvMeta {
  cooked?: string[];
  remain?: string[];
}

const parseNpmArgv = (): NpmArgvMeta | null => {
  const raw = process.env.npm_config_argv;
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as NpmArgvMeta;
  } catch {
    return null;
  }
};

const getNpmConfigValue = (name: string): string | undefined => {
  const envKey = `npm_config_${name.replace(/-/g, '_')}`;
  return process.env[envKey];
};

const parseBooleanLike = (value: string | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return true;
};

const didRequestFlag = (meta: NpmArgvMeta | null, flag: string): boolean => {
  if (!meta?.cooked) {
    return false;
  }
  return meta.cooked.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
};

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
  reuseCurrent?: boolean;
  noReuseCurrent?: boolean;
}

const collectToolArgs = (value: string, previous: string[] = []): string[] => {
  if (!value) {
    return previous;
  }
  return [...previous, value];
};

export const registerStartCommand = (program: Command): void => {
  program
    .command('start', { isDefault: true })
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
    .option('--reuse-current', '直接在当前目录启动 AI 工具，不创建工作树')
    .option('--no-reuse-current', '禁用自动复用当前目录，强制进入创建流程')
    .action(async (taskName: string | undefined, options: StartOptions) => {
      const config = await loadConfig();

      if (options.reuseCurrent && options.noReuseCurrent) {
        throw new Error('不能同时指定 --reuse-current 与 --no-reuse-current。');
      }

      const npmArgv = parseNpmArgv();
      const valuesConsumedFromNpm = new Set<string>();

      const applyNpmStringOption = (flag: string, key: string, assign: (value: string) => void) => {
        if (!didRequestFlag(npmArgv, flag)) {
          return;
        }
        const value = getNpmConfigValue(key);
        if (!value) {
          return;
        }
        assign(value);
        if (npmArgv?.remain?.includes(value)) {
          valuesConsumedFromNpm.add(value);
        }
      };

      const applyNpmBooleanOption = (flag: string, key: string, assign: (value: boolean) => void) => {
        if (!didRequestFlag(npmArgv, flag)) {
          return;
        }
        const parsed = parseBooleanLike(getNpmConfigValue(key));
        if (parsed === undefined) {
          assign(true);
        } else {
          assign(parsed);
        }
      };

      applyNpmStringOption('--repo', 'repo', (value) => {
        options.repo = value;
      });
      applyNpmStringOption('--base', 'base', (value) => {
        options.base = value;
      });
      applyNpmStringOption('--worktree', 'worktree', (value) => {
        options.worktreePath = value;
      });
      applyNpmStringOption('--tool', 'tool', (value) => {
        options.tool = value;
      });
      applyNpmStringOption('--tool-arg', 'tool_arg', (value) => {
        options.toolArg = [...(options.toolArg ?? []), value];
      });
      applyNpmStringOption('--permission-mode', 'permission_mode', (value) => {
        options.permissionMode = value as PermissionMode;
      });

      applyNpmBooleanOption('--skip-launch', 'skip_launch', (value) => {
        options.skipLaunch = value;
      });
      applyNpmBooleanOption('--non-interactive', 'non_interactive', (value) => {
        options.nonInteractive = value;
      });
      applyNpmBooleanOption('--yes', 'yes', (value) => {
        options.yes = value;
      });
      applyNpmBooleanOption('--reuse-current', 'reuse_current', (value) => {
        options.reuseCurrent = value;
      });
      if (didRequestFlag(npmArgv, '--no-reuse-current')) {
        const parsed = parseBooleanLike(getNpmConfigValue('no_reuse_current'));
        const resolved = parsed === undefined ? true : parsed;
        options.noReuseCurrent = resolved;
        if (resolved) {
          options.reuseCurrent = false;
        }
      }
      if (options.reuseCurrent === false && !options.noReuseCurrent) {
        options.noReuseCurrent = true;
      }

      const nonInteractive = options.nonInteractive || options.yes;

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
        if (options.reuseCurrent) {
          throw new Error('无法确定 Git 仓库路径，请使用 --repo 指定。');
        }
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

      if (taskName && valuesConsumedFromNpm.has(taskName)) {
        taskName = undefined;
      }

      const shouldImplicitlyReuse =
        !options.noReuseCurrent &&
        options.reuseCurrent !== true &&
        !nonInteractive &&
        !taskName &&
        !options.base &&
        !options.worktreePath;

      const shouldReuseCurrent = options.reuseCurrent === true || shouldImplicitlyReuse;

      if (shouldReuseCurrent) {
        if (options.base) {
          throw new Error('--reuse-current 模式不支持指定 --base。');
        }
        if (taskName) {
          logger.warn('已忽略任务名 %s，因为当前模式不会创建新分支。', taskName);
        }

        let workingDirectory: string;
        if (options.worktreePath) {
          const resolvedWorkingDirectory = path.resolve(options.worktreePath);
          if (!(await pathExists(resolvedWorkingDirectory))) {
            throw new Error(`指定的目录不存在：${resolvedWorkingDirectory}`);
          }
          workingDirectory = resolvedWorkingDirectory;
        } else if (options.repo) {
          workingDirectory = repoPath;
        } else {
          workingDirectory = process.cwd();
        }

        logger.info('将在目录 %s 启动 AI 工具（不创建工作树）。', workingDirectory);

        const updatedConfig = updateRecentRepos(
          {
            ...config,
            defaultRepo: repoPath
          },
          repoPath
        );

        await saveConfig(updatedConfig);

        if (!options.skipLaunch) {
          const launched = await launchTool(updatedConfig, {
            toolName: options.tool,
            permissionMode: options.permissionMode,
            extraArgs: options.toolArg,
            workingDirectory
          });
          if (launched) {
            logger.info('AI 工具已启动，结束后按 Ctrl+C 返回即可。');
          }
        } else {
          logger.info('已跳过 AI 工具启动，目录：%s', workingDirectory);
        }

        return;
      }

      const defaultBase = options.base ?? (await detectDefaultBaseBranch(git));
      const baseBranch = options.base
        ? options.base
        : nonInteractive
          ? defaultBase
          : await promptForBaseBranch(branches.all, defaultBase);

      let providedTask = taskName;

      if (providedTask && valuesConsumedFromNpm.has(providedTask)) {
        providedTask = undefined;
      }

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
          const launched = await launchTool(config, {
            toolName: options.tool,
            permissionMode: options.permissionMode,
            extraArgs: options.toolArg,
            workingDirectory: existingWorktree.path
          });
          if (launched) {
            logger.info('AI 工具已启动，结束后按 Ctrl+C 返回即可。');
          }
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
          worktreePath,
          baseBranch // 记录基线分支
        }
      );

      await saveConfig(updatedConfig);

      if (!options.skipLaunch) {
        const launched = await launchTool(updatedConfig, {
          toolName: options.tool,
          permissionMode: options.permissionMode,
          extraArgs: options.toolArg,
          workingDirectory: worktreePath
        });
        if (launched) {
          logger.info('已在 %s 中启动 AI 工具，结束后 Ctrl+C 返回即可。', worktreePath);
        }
      } else {
        logger.info('已跳过 AI 工具启动。');
        logger.info('可以执行：cd %s', worktreePath);
      }

      logger.raw('完成后可执行：treeai finish %s', normalizedTask);
    });
};
