import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { PermissionMode, TreeAIConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface LaunchToolOptions {
  toolName?: string;
  workingDirectory: string;
  extraArgs?: string[];
  permissionMode?: PermissionMode;
  dryRun?: boolean;
}

const PERMISSION_MODE_ARGS: Record<PermissionMode, string[]> = {
  default: [],
  acceptEdits: ['--permission-mode', 'acceptEdits'],
  bypassPermissions: ['--dangerously-skip-permissions'],
  sandboxBashMode: ['--permission-mode', 'sandboxBashMode'],
  strict: ['--strict-permissions']
};

const hasPathSeparator = (target: string): boolean => target.includes('/') || target.includes('\\');

const resolveExecutable = async (executable: string): Promise<string | null> => {
  if (!executable) {
    return null;
  }

  const checkCandidate = async (candidate: string): Promise<boolean> => {
    try {
      return await fs.pathExists(candidate);
    } catch {
      return false;
    }
  };

  if (path.isAbsolute(executable) || hasPathSeparator(executable)) {
    return (await checkCandidate(executable)) ? executable : null;
  }

  const pathEnv = process.env.PATH ?? '';
  if (!pathEnv) {
    return null;
  }

  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .filter(Boolean)
      : [''];

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) {
      continue;
    }

    for (const ext of extensions) {
      const suffix = ext.startsWith('.') || ext === '' ? ext : `.${ext}`;
      const candidate = path.join(dir, `${executable}${suffix}`);
      if (await checkCandidate(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

export const buildToolCommand = (
  config: TreeAIConfig,
  options: LaunchToolOptions
): { executable: string; args: string[] } | null => {
  const toolName = options.toolName || config.defaultAiTool;
  if (!toolName) {
    return null;
  }

  const preset = config.toolPresets[toolName];
  if (!preset) {
    logger.warn('未找到 %s 的工具预设配置，请检查 config.json。', toolName);
    return null;
  }

  const args: string[] = [];

  // 使用工具预设的参数（完全控制）
  args.push(...(preset.args ?? []));

  // 只有用户明确指定 permissionMode 时才添加权限参数
  if (options.permissionMode) {
    const permissionArgs = PERMISSION_MODE_ARGS[options.permissionMode] ?? [];
    for (const permArg of permissionArgs) {
      if (!args.includes(permArg)) {
        args.push(permArg);
      }
    }
  }

  // 添加用户额外指定的参数
  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return {
    executable: preset.executable,
    args
  };
};

export const launchTool = async (
  config: TreeAIConfig,
  options: LaunchToolOptions
): Promise<boolean> => {
  const command = buildToolCommand(config, options);
  if (!command) {
    return false;
  }

  const cwd = path.resolve(options.workingDirectory);
  const resolvedExecutable = await resolveExecutable(command.executable);

  if (!resolvedExecutable) {
    logger.error(
      '未找到可执行文件：%s。请确认工具已安装，或在 ~/.config/treeai/config.json 更新该工具的 executable 字段。',
      command.executable
    );
    logger.info('可执行：treeai status 查看当前工具配置。');
    process.exitCode = 1;
    return false;
  }

  if (options.dryRun) {
    logger.info('模拟执行：%s %s', resolvedExecutable, command.args.join(' '));
    logger.info('工作目录：%s', cwd);
    return true;
  }

  logger.info('正在启动 %s...', command.executable);
  logger.debug('command=%o', command);

  const child = spawn(resolvedExecutable, command.args, {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  child.on('error', (error) => {
    logger.error('启动 %s 失败：%s', command.executable, error.message);
    process.exitCode = 1;
  });

  return true;
};
