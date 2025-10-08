import path from 'node:path';
import simpleGit, { SimpleGit } from 'simple-git';

export interface WorktreeInfo {
  path: string;
  branch?: string;
  head?: string;
  isBare?: boolean;
}

export interface RepoContext {
  git: SimpleGit;
  repoPath: string;
}

export const resolveRepoRoot = async (startPath: string = process.cwd()): Promise<string | null> => {
  try {
    const git = simpleGit({ baseDir: startPath });
    const topLevel = await git.revparse(['--show-toplevel']);
    return topLevel.trim();
  } catch (error) {
    return null;
  }
};

export const resolveMainRepoPath = async (startPath: string = process.cwd()): Promise<string | null> => {
  try {
    const git = simpleGit({ baseDir: startPath });
    const commonDirRaw = await git.raw(['rev-parse', '--git-common-dir']);
    const commonDir = commonDirRaw.trim();
    const absoluteCommonDir = path.isAbsolute(commonDir)
      ? commonDir
      : path.resolve(startPath, commonDir);
    return path.dirname(absoluteCommonDir);
  } catch (error) {
    return null;
  }
};

export const getRepo = async (startPath: string = process.cwd()): Promise<RepoContext> => {
  const repoPath = await resolveRepoRoot(startPath);
  if (!repoPath) {
    throw new Error('当前目录不在 Git 仓库中，请使用 --repo 指定仓库路径。');
  }
  return {
    git: simpleGit({ baseDir: repoPath }),
    repoPath
  };
};

export const getCurrentBranch = async (cwd: string = process.cwd()): Promise<string | null> => {
  try {
    const git = simpleGit({ baseDir: cwd });
    const branch = await git.raw(['rev-parse', '--abbrev-ref', 'HEAD']);
    return branch.trim();
  } catch (error) {
    return null;
  }
};

export const branchExists = async (git: SimpleGit, branchName: string): Promise<boolean> => {
  const branches = await git.branchLocal();
  return branches.all.includes(branchName);
};

export const isBranchMergedInto = async (
  git: SimpleGit,
  branchName: string,
  baseBranch: string
): Promise<boolean> => {
  try {
    await git.raw(['merge-base', '--is-ancestor', branchName, baseBranch]);
    return true;
  } catch (error) {
    return false;
  }
};

export const detectDefaultBaseBranch = async (git: SimpleGit): Promise<string> => {
  const branches = await git.branchLocal();
  const priorities = ['main', 'master', 'develop', 'dev'];
  for (const candidate of priorities) {
    if (branches.all.includes(candidate)) {
      return candidate;
    }
  }
  return branches.current;
};

export const createBranchFromBase = async (
  git: SimpleGit,
  branchName: string,
  baseBranch: string
): Promise<void> => {
  await git.raw(['branch', branchName, baseBranch]);
};

export const createWorktree = async (
  git: SimpleGit,
  branchName: string,
  worktreePath: string,
  baseBranch?: string
): Promise<void> => {
  const exists = await branchExists(git, branchName);
  const args = ['worktree', 'add'];
  if (!exists && baseBranch) {
    args.push('-b', branchName);
  }
  args.push(worktreePath);
  args.push(!exists && baseBranch ? baseBranch : branchName);

  await git.raw(args);
};

export const mergeBranchIntoCurrent = async (git: SimpleGit, branchName: string): Promise<void> => {
  await git.merge([branchName]);
};

export const abortMerge = async (git: SimpleGit): Promise<void> => {
  await git.raw(['merge', '--abort']);
};

export const removeWorktree = async (git: SimpleGit, worktreePath: string, force = false): Promise<void> => {
  const args = ['worktree', 'remove'];
  if (force) {
    args.push('--force');
  }
  args.push(worktreePath);
  await git.raw(args);
};

export const deleteBranch = async (git: SimpleGit, branchName: string, force = false): Promise<void> => {
  const args = ['branch', force ? '-D' : '-d', branchName];
  await git.raw(args);
};

export const checkoutBranch = async (git: SimpleGit, branchName: string): Promise<void> => {
  await git.checkout(branchName);
};

export const listWorktrees = async (git: SimpleGit): Promise<WorktreeInfo[]> => {
  const output = await git.raw(['worktree', 'list', '--porcelain']);
  const lines = output.split('\n');
  const worktrees: WorktreeInfo[] = [];
  let current: WorktreeInfo | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith('worktree ')) {
      if (current) {
        worktrees.push(current);
      }
      current = {
        path: line.replace('worktree ', '').trim()
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('branch ')) {
      const ref = line.replace('branch ', '').trim();
      current.branch = ref.replace('refs/heads/', '');
    } else if (line.startsWith('HEAD ')) {
      current.head = line.replace('HEAD ', '').trim();
    } else if (line === 'bare') {
      current.isBare = true;
    }
  }

  if (current) {
    worktrees.push(current);
  }

  return worktrees;
};

export const findWorktreeByBranch = async (
  git: SimpleGit,
  branchName: string
): Promise<WorktreeInfo | undefined> => {
  const worktrees = await listWorktrees(git);
  return worktrees.find((wt) => wt.branch === branchName);
};

export const findWorktreeByPath = async (git: SimpleGit, worktreePath: string): Promise<WorktreeInfo | undefined> => {
  const worktrees = await listWorktrees(git);
  const normalized = path.resolve(worktreePath);
  return worktrees.find((wt) => path.resolve(wt.path) === normalized);
};

export const isWorktreeClean = async (worktreePath: string): Promise<boolean> => {
  const git = simpleGit({ baseDir: worktreePath });
  const status = await git.status();
  return status.isClean();
};
