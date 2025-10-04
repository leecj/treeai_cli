import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { DEFAULT_CONFIG, HistoryTask, TreeAIConfig } from '../types/index.js';

const CONFIG_DIR_NAME = 'treeai';
const CONFIG_FILE_NAME = 'config.json';
const MAX_RECENT_REPOS = 5;
const MAX_HISTORY_TASKS = 5;

interface ConfigPaths {
  dir: string;
  file: string;
}

const getConfigDir = (): string => {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, CONFIG_DIR_NAME);
};

export const getConfigPaths = (): ConfigPaths => {
  const dir = getConfigDir();
  return {
    dir,
    file: path.join(dir, CONFIG_FILE_NAME)
  };
};

export const loadConfig = async (): Promise<TreeAIConfig> => {
  const { dir, file } = getConfigPaths();
  await fs.ensureDir(dir);

  if (!(await fs.pathExists(file))) {
    await fs.writeJson(file, DEFAULT_CONFIG, { spaces: 2 });
    return { ...DEFAULT_CONFIG };
  }

  const raw = await fs.readJson(file);
  const config: TreeAIConfig = {
    ...DEFAULT_CONFIG,
    ...raw,
    history: {
      tasks: raw.history?.tasks ?? []
    }
  };

  if (!config.defaultAiTool) {
    config.defaultAiTool = DEFAULT_CONFIG.defaultAiTool;
  }

  return config;
};

export const saveConfig = async (config: TreeAIConfig): Promise<void> => {
  const { file } = getConfigPaths();
  await fs.writeJson(file, config, { spaces: 2 });
};

export const updateRecentRepos = (config: TreeAIConfig, repoPath: string): TreeAIConfig => {
  const recent = [repoPath, ...config.recentRepos.filter((repo) => repo !== repoPath)].slice(0, MAX_RECENT_REPOS);
  return {
    ...config,
    recentRepos: recent
  };
};

export const recordTaskHistory = (
  config: TreeAIConfig,
  task: Omit<HistoryTask, 'lastUsed'>
): TreeAIConfig => {
  const now = new Date().toISOString();
  const existing = config.history.tasks.filter(
    (item) => !(item.name === task.name && item.repo === task.repo)
  );

  const updated: HistoryTask[] = [
    {
      ...task,
      lastUsed: now
    },
    ...existing
  ].slice(0, MAX_HISTORY_TASKS);

  return {
    ...config,
    history: {
      tasks: updated
    }
  };
};

export const getWorktreeRoot = (config: TreeAIConfig, repoPath: string): string => {
  if (config.worktreeRoot) {
    return config.worktreeRoot;
  }
  const repoName = path.basename(repoPath);
  return path.join(os.homedir(), '.treeai', repoName);
};
