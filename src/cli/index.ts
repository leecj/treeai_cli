import { Command } from 'commander';
import { createRequire } from 'node:module';
import { registerStartCommand } from './start.js';
import { registerFinishCommand } from './finish.js';
import { registerStatusCommand } from './status.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export const createCLI = (): Command => {
  const program = new Command();

  program
    .name('treeai')
    .description('TreeAI CLI - Git worktree 自动化助手')
    .version(pkg.version ?? '0.0.0');

  registerStartCommand(program);
  registerFinishCommand(program);
  registerStatusCommand(program);

  program.configureOutput({
    outputError: (str, write) => {
      write(str);
    }
  });

  return program;
};
