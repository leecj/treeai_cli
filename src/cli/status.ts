import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from '../services/config.js';
import { getRepo, listWorktrees, resolveMainRepoPath } from '../services/git.js';
import { logger } from '../utils/logger.js';

interface StatusOptions {
  repo?: string;
}

export const registerStatusCommand = (program: Command): void => {
  program
    .command('status')
    .description('查看 TreeAI 当前状态')
    .option('--repo <path>', '指定目标仓库路径')
    .action(async (options: StatusOptions) => {
      const config = await loadConfig();
      logger.info('默认仓库：%s', config.defaultRepo ?? '未设置');
      logger.info('默认 AI 工具：%s', config.defaultAiTool ?? '未设置');
      if (config.recentRepos.length) {
        logger.info('最近仓库：');
        for (const repo of config.recentRepos) {
          logger.raw(`  - ${repo}`);
        }
      }

      if (config.history.tasks.length) {
        logger.info('最近任务：');
        for (const task of config.history.tasks) {
          logger.raw(`  - ${task.name} (${task.branch}) @ ${task.repo}`);
        }
      }

      let repoPath = options.repo ? path.resolve(options.repo) : config.defaultRepo;
      if (!repoPath) {
        const detected = await resolveMainRepoPath(process.cwd());
        if (detected) {
          repoPath = detected;
        }
      }

      if (!repoPath) {
        logger.warn('未指定仓库，跳过工作树列表。');
        return;
      }

      try {
        const { git, repoPath: resolved } = await getRepo(repoPath);
        const worktrees = await listWorktrees(git);
        logger.info('仓库：%s', resolved);
        logger.info('工作树列表：');
        worktrees.forEach((wt) => {
          const label = wt.branch ?? '(detached)';
          logger.raw(`  - ${label.padEnd(25, ' ')} ${wt.path}`);
        });
      } catch (error) {
        logger.error('无法读取仓库信息：%s', (error as Error).message);
      }
    });
};
