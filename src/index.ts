#!/usr/bin/env node
import process from 'node:process';
import { createCLI } from './cli/index.js';
import { logger } from './utils/logger.js';

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

const normalizeNpmRunArgs = (): void => {
  if (!process.env.npm_lifecycle_event) {
    return;
  }

  const originalArgs = process.argv.slice(2);
  if (originalArgs.length === 0) {
    return;
  }

  const normalizedArgs: string[] = [];
  const takeNextValue = (): string | undefined => {
    if (originalArgs.length === 0) {
      return undefined;
    }
    return originalArgs.shift();
  };

  const stringOptions: Array<{ flag: string; envKey: string }> = [
    { flag: '--repo', envKey: 'npm_config_repo' },
    { flag: '--base', envKey: 'npm_config_base' },
    { flag: '--worktree', envKey: 'npm_config_worktree' },
    { flag: '--tool', envKey: 'npm_config_tool' },
    { flag: '--permission-mode', envKey: 'npm_config_permission_mode' },
    { flag: '--tool-arg', envKey: 'npm_config_tool_arg' }
  ];

  for (const { flag, envKey } of stringOptions) {
    const raw = process.env[envKey];
    if (raw === undefined) {
      continue;
    }

    let value = raw;
    if (raw === 'true') {
      value = takeNextValue() ?? '';
    }

    if (!value) {
      continue;
    }

    normalizedArgs.push(flag, value);
  }

  const booleanOptions: Array<{ flag: string; envKey: string; negativeFlag?: string }> = [
    { flag: '--skip-launch', envKey: 'npm_config_skip_launch' },
    { flag: '--non-interactive', envKey: 'npm_config_non_interactive' },
    { flag: '--yes', envKey: 'npm_config_yes' },
    { flag: '--reuse-current', envKey: 'npm_config_reuse_current', negativeFlag: '--no-reuse-current' }
  ];

  for (const { flag, envKey, negativeFlag } of booleanOptions) {
    const parsed = parseBooleanLike(process.env[envKey]);
    if (parsed === undefined) {
      continue;
    }
    if (parsed) {
      normalizedArgs.push(flag);
    } else if (negativeFlag) {
      normalizedArgs.push(negativeFlag);
    }
  }

  normalizedArgs.push(...originalArgs);

  process.argv = [process.argv[0], process.argv[1], ...normalizedArgs];
};

const run = async () => {
  const program = createCLI();
  try {
    normalizeNpmRunArgs();
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error((error as Error).message);
    process.exitCode = 1;
  }
};

run();
