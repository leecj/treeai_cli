import { spawn } from 'node:child_process';
import path from 'node:path';
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

const dedupeArgs = (args: string[]): string[] => {
  const result: string[] = [];
  for (const arg of args) {
    if (!result.includes(arg)) {
      result.push(arg);
    }
  }
  return result;
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
  args.push(...(preset.args ?? []));

  if (options.permissionMode) {
    args.push(...(PERMISSION_MODE_ARGS[options.permissionMode] ?? []));
  } else {
    args.push(...(PERMISSION_MODE_ARGS[config.defaultPermissionMode] ?? []));
  }

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  return {
    executable: preset.executable,
    args: dedupeArgs(args)
  };
};

export const launchTool = async (
  config: TreeAIConfig,
  options: LaunchToolOptions
): Promise<void> => {
  const command = buildToolCommand(config, options);
  if (!command) {
    return;
  }

  const cwd = path.resolve(options.workingDirectory);

  if (options.dryRun) {
    logger.info('模拟执行：%s %s', command.executable, command.args.join(' '));
    logger.info('工作目录：%s', cwd);
    return;
  }

  logger.info('正在启动 %s...', command.executable);
  logger.debug('command=%o', command);

  const child = spawn(command.executable, command.args, {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  child.on('error', (error) => {
    logger.error('启动 %s 失败：%s', command.executable, error.message);
  });
};
