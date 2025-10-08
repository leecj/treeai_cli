import path from 'node:path';
import { Command } from 'commander';
import {
  deleteBranch,
  detectDefaultBaseBranch,
  getRepo,
  getCurrentBranch,
  isBranchMergedInto,
  isWorktreeClean,
  listWorktrees,
  mergeBranchIntoCurrent,
  removeWorktree,
  abortMerge,
  resolveMainRepoPath,
  resolveRepoRoot
} from '../services/git.js';
import { loadConfig, saveConfig, updateRecentRepos } from '../services/config.js';
import { promptConfirm, promptFinishOptions, promptForRepo, promptSelectWorktree } from '../ui/prompts.js';
import { logger } from '../utils/logger.js';
import { normalizeTaskName, toBranchName } from '../utils/task.js';

interface FinishOptions {
  repo?: string;
  keepBranch?: boolean;
  force?: boolean;
  yes?: boolean;
  nonInteractive?: boolean;
  noCleanup?: boolean;
  base?: string;
}

type FinishAction = 'checkoutBase' | 'removeWorktree' | 'deleteBranch';

export const registerFinishCommand = (program: Command): void => {
  program
    .command('finish')
    .argument('[taskName]', '任务名称或分支名称')
    .description('清理工作树并完成任务')
    .option('--repo <path>', '指定 Git 仓库路径')
    .option('--keep-branch', '保留分支，不在完成时删除', false)
    .option('--no-cleanup', '仅切换分支，不删除工作树', false)
    .option('--force', '强制执行，包括未提交更改或删除未合并分支', false)
    .option('--yes', '跳过确认提示', false)
    .option('--non-interactive', '非交互模式，缺失信息时报错', false)
    .option('--base <branch>', '完成后切换到指定基础分支')
    .action(async (taskName: string | undefined, options: FinishOptions) => {
      const nonInteractive = options.nonInteractive || options.yes;
      const config = await loadConfig();

      let repoPath: string | undefined;

      if (options.repo) {
        repoPath = path.resolve(options.repo);
      } else {
        // 优先检测当前目录
        const detected = await resolveMainRepoPath(process.cwd());
        if (detected) {
          repoPath = detected;
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

      const baseBranch = options.base ?? (await detectDefaultBaseBranch(git));
      const worktrees = (await listWorktrees(git)).filter((wt) => path.resolve(wt.path) !== path.resolve(repoPath!));

      if (!worktrees.length) {
        throw new Error('当前仓库没有可清理的工作树。');
      }

      const currentWorktreePath = await resolveRepoRoot(process.cwd());

      let target = await (async () => {
        if (taskName) {
          const normalized = normalizeTaskName(taskName);
          const branchCandidate = toBranchName(normalized);
          const directBranchMatch = worktrees.find((wt) => wt.branch === taskName);
          if (directBranchMatch) {
            return directBranchMatch;
          }
          const normalizedBranchMatch = worktrees.find((wt) => wt.branch === branchCandidate);
          if (normalizedBranchMatch) {
            return normalizedBranchMatch;
          }
          const pathMatch = worktrees.find((wt) => path.resolve(wt.path) === path.resolve(taskName));
          if (pathMatch) {
            return pathMatch;
          }
        }

        if (currentWorktreePath && path.resolve(currentWorktreePath) !== path.resolve(repoPath!)) {
          const current = worktrees.find((wt) => path.resolve(wt.path) === path.resolve(currentWorktreePath));
          if (current) {
            return current;
          }
        }

        if (nonInteractive) {
          throw new Error('非交互模式下需要明确的任务名称或分支。');
        }

        const selection = await promptSelectWorktree(
          worktrees.map((wt) => ({
            label: `${wt.branch ?? path.basename(wt.path)}  -> ${wt.path}`,
            value: wt.path
          }))
        );
        return worktrees.find((wt) => wt.path === selection)!;
      })();

      if (!target.branch) {
        throw new Error('无法识别目标工作树的分支名称。');
      }

      const clean = await isWorktreeClean(target.path);
      if (!clean && !options.force) {
        if (nonInteractive) {
          throw new Error(`工作树 ${target.path} 存在未提交更改，请提交或使用 --force。`);
        }
        const proceed = await promptConfirm(
          `工作树 ${target.path} 存在未提交更改，是否仍然继续清理？`,
          false
        );
        if (!proceed) {
          throw new Error('操作已取消。');
        }
      }

      const defaultSelections = new Set<FinishAction>();
      if (!options.noCleanup) {
        defaultSelections.add('removeWorktree');
      }
      if (!options.keepBranch && target.branch) {
        defaultSelections.add('deleteBranch');
      }
      defaultSelections.add('checkoutBase');

      if (!nonInteractive) {
        logger.info('可选操作说明：');
        logger.raw('  - 切换主工作树：在主仓库中 checkout 到基础分支，便于继续日常开发。');
        logger.raw('  - 删除工作树目录：移除 %s 目录，释放磁盘空间。', target.path);
        logger.raw('  - 删除分支：删除本地分支 %s（若已合并可安全删除）。', target.branch);
      }

      const selections = nonInteractive
        ? Array.from(defaultSelections)
        : await promptFinishOptions<FinishAction>(
            [
              {
                value: 'checkoutBase',
                name: `切换主工作树到 ${baseBranch}`,
                checked: defaultSelections.has('checkoutBase')
              },
              {
                value: 'removeWorktree',
                name: `删除工作树目录 ${target.path}`,
                checked: defaultSelections.has('removeWorktree')
              },
              {
                value: 'deleteBranch',
                name: `删除分支 ${target.branch}`,
                checked: defaultSelections.has('deleteBranch')
              }
            ]
          );

      const actions = new Set<FinishAction>(selections);
      const performedActions = new Set<FinishAction>();

      const originalBranch = await getCurrentBranch(repoPath!);
      let currentBranch = originalBranch;

      if (actions.has('checkoutBase')) {
        try {
          await git.checkout(baseBranch);
          currentBranch = baseBranch;
          performedActions.add('checkoutBase');
          logger.success('已切换主工作树到 %s', baseBranch);
        } catch (error) {
          logger.warn('切换到 %s 失败：%s', baseBranch, (error as Error).message);
          currentBranch = await getCurrentBranch(repoPath!);
        }
      }

      const needsCleanup = actions.has('removeWorktree') || actions.has('deleteBranch');
      let allowCleanup = true;

      if (needsCleanup && target.branch) {
        let mergedIntoBase = await isBranchMergedInto(git, target.branch, baseBranch);

        if (!mergedIntoBase) {
          if (allowCleanup) {
            const baseClean = await isWorktreeClean(repoPath!);
            if (!baseClean && !options.force) {
              allowCleanup = false;
              logger.error('基础工作树 %s 存在未提交更改，请先提交或使用 --force。', repoPath!);
            } else if (!baseClean) {
              logger.warn('基础工作树 %s 存在未提交更改，在 --force 模式下继续。', repoPath!);
            }
          }

          if (allowCleanup) {
            let switchedTemporarily = false;
            try {
              if (currentBranch !== baseBranch) {
                await git.checkout(baseBranch);
                currentBranch = baseBranch;
                if (actions.has('checkoutBase')) {
                  performedActions.add('checkoutBase');
                } else {
                  switchedTemporarily = true;
                  logger.info('为保证合并，暂时切换到 %s。', baseBranch);
                }
              }

              await mergeBranchIntoCurrent(git, target.branch);
              mergedIntoBase = true;
              logger.success('已将 %s 合并到 %s。', target.branch, baseBranch);
            } catch (error) {
              allowCleanup = false;
              logger.error('合并 %s -> %s 失败：%s', target.branch, baseBranch, (error as Error).message);
              try {
                await abortMerge(git);
              } catch (abortError) {
                logger.warn('尝试回滚未完成的合并失败：%s', (abortError as Error).message);
              }
            } finally {
              if (switchedTemporarily) {
                try {
                  if (originalBranch && originalBranch !== baseBranch) {
                    await git.checkout(originalBranch);
                    currentBranch = originalBranch;
                    logger.info('合并完成后已恢复到原始分支 %s。', originalBranch);
                  }
                } catch (restoreError) {
                  logger.warn('恢复到原始分支失败：%s', (restoreError as Error).message);
                }
              }
            }
          }
        }

        if (!mergedIntoBase && allowCleanup) {
          if (options.force) {
            logger.warn('分支 %s 尚未合并到 %s，已在 --force 模式下继续清理。', target.branch, baseBranch);
          } else {
            allowCleanup = false;
            logger.warn('分支 %s 尚未合并到 %s，已取消清理操作。', target.branch, baseBranch);
          }
        }
      }

      if (allowCleanup) {
        if (actions.has('removeWorktree')) {
          logger.info('正在删除工作树 %s ...', target.path);
          await removeWorktree(git, target.path, options.force);
          performedActions.add('removeWorktree');
          logger.success('工作树已删除。');
        } else {
          logger.info('已选择保留工作树：%s', target.path);
        }

        if (actions.has('deleteBranch') && target.branch) {
          try {
            logger.info('正在删除分支 %s ...', target.branch);
            await deleteBranch(git, target.branch, options.force);
            performedActions.add('deleteBranch');
            logger.success('分支 %s 已删除。', target.branch);
          } catch (error) {
            logger.warn('删除分支失败：%s', (error as Error).message);
          }
        } else if (target.branch) {
          logger.info('保留分支 %s。', target.branch);
        }
      } else {
        if (actions.has('removeWorktree')) {
          logger.warn('已跳过删除工作树 %s，待成功合并后再执行。', target.path);
        } else {
          logger.info('已选择保留工作树：%s', target.path);
        }

        if (actions.has('deleteBranch') && target.branch) {
          logger.warn('已跳过删除分支 %s，待成功合并后再执行。', target.branch);
        } else if (target.branch) {
          logger.info('保留分支 %s。', target.branch);
        }
      }

      const updatedRecent = updateRecentRepos(
        {
          ...config,
          defaultRepo: repoPath!
        },
        repoPath!
      );

      const updatedConfig = {
        ...updatedRecent,
        history: {
          tasks: updatedRecent.history.tasks.map((task) =>
            task.repo === repoPath! && task.branch === target.branch
              ? {
                  ...task,
                  worktreePath: target.path,
                  lastUsed: new Date().toISOString()
                }
              : task
          )
        }
      };

      await saveConfig(updatedConfig);

      const executedSteps: string[] = [];
      if (performedActions.has('checkoutBase')) {
        executedSteps.push(`切换到 ${baseBranch}`);
      }
      if (performedActions.has('removeWorktree')) {
        executedSteps.push('清理工作树目录');
      }
      if (performedActions.has('deleteBranch')) {
        executedSteps.push('删除本地分支');
      }
      if (executedSteps.length) {
        logger.info('执行步骤：%s', executedSteps.join(' -> '));
      }

      const skippedSteps: string[] = [];
      if (actions.has('checkoutBase') && !performedActions.has('checkoutBase')) {
        skippedSteps.push(`切换到 ${baseBranch}`);
      }
      if (actions.has('removeWorktree') && !performedActions.has('removeWorktree')) {
        skippedSteps.push('清理工作树目录');
      }
      if (actions.has('deleteBranch') && !performedActions.has('deleteBranch')) {
        skippedSteps.push('删除本地分支');
      }
      if (skippedSteps.length) {
        logger.warn('未执行步骤：%s', skippedSteps.join('、'));
      }

      const allCompleted = Array.from(actions).every((action) => performedActions.has(action));
      if (allCompleted) {
        logger.success('完成：%s', target.branch);
      } else {
        logger.warn('完成：%s（部分步骤未执行，请处理后重试）', target.branch);
      }
      logger.info('如需重新开始，可执行：treeai start %s', target.branch);
    });
};
