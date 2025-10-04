import path from 'node:path';
import fs from 'fs-extra';
import { TreeAIConfig } from '../types/index.js';
import { getWorktreeRoot } from './config.js';
import { buildWorktreePath } from '../utils/task.js';

export const computeWorktreePath = (
  config: TreeAIConfig,
  repoPath: string,
  branchName: string,
  overridePath?: string
): string => {
  if (overridePath) {
    return path.resolve(overridePath);
  }
  const root = getWorktreeRoot(config, repoPath);
  return buildWorktreePath(root, branchName);
};

export const ensureWorktreeParent = async (worktreePath: string): Promise<void> => {
  const parent = path.dirname(worktreePath);
  await fs.ensureDir(parent);
};

export const pathExists = async (targetPath: string): Promise<boolean> => fs.pathExists(targetPath);

export const isDirectoryEmpty = async (targetPath: string): Promise<boolean> => {
  try {
    const files = await fs.readdir(targetPath);
    return files.length === 0;
  } catch (error) {
    return false;
  }
};

export const removeDirectory = async (targetPath: string): Promise<void> => {
  await fs.remove(targetPath);
};
