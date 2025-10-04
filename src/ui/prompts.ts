import { checkbox, confirm, input, select } from '@inquirer/prompts';

interface RepoChoiceOptions {
  recentRepos: string[];
  defaultRepo?: string;
}

export const promptForRepo = async ({
  recentRepos,
  defaultRepo
}: RepoChoiceOptions): Promise<string | null> => {
  if (!recentRepos.length) {
    return null;
  }

  const choices = recentRepos.map((repo) => ({ name: repo, value: repo }));
  return select({
    message: '选择一个 Git 仓库',
    choices,
    default: defaultRepo
  });
};

export const promptForTaskName = async (defaultValue?: string): Promise<string> =>
  input({
    message: '请输入任务名称（用于分支名）',
    default: defaultValue ?? ''
  });

export const promptForBaseBranch = async (
  candidates: string[],
  defaultBranch: string
): Promise<string> => {
  if (candidates.length === 0) {
    return defaultBranch;
  }
  return select({
    message: '选择基础分支',
    choices: candidates.map((branch) => ({ name: branch, value: branch })),
    default: defaultBranch
  });
};

export const promptConfirm = async (message: string, defaultValue = true): Promise<boolean> =>
  confirm({
    message,
    default: defaultValue
  });

export const promptTaskFromHistory = async (
  tasks: { name: string; branch: string }[]
): Promise<string | null> => {
  if (!tasks.length) {
    return null;
  }
  return select({
    message: '选择一个最近使用的任务',
    choices: tasks.map((task) => ({
      name: `${task.name} (${task.branch})`,
      value: task.name
    }))
  });
};

export const promptFinishOptions = async <T extends string>(
  options: { name: string; value: T; checked?: boolean; description?: string }[],
  message = '选择要执行的清理动作'
): Promise<T[]> =>
  checkbox({
    message,
    choices: options
  });

export const promptSelectWorktree = async (
  worktrees: { label: string; value: string }[],
  message = '选择要结束的工作树'
): Promise<string> =>
  select({
    message,
    choices: worktrees.map((item) => ({ name: item.label, value: item.value }))
  });
