import chalk from 'chalk';
import createDebug from 'debug';

const debugLogger = createDebug('treeai');

const format = (message: string, ...args: unknown[]): string => {
  if (!args.length) {
    return message;
  }
  return message.replace(/%s|%d|%j/g, () => String(args.shift()));
};

export const logger = {
  info(message: string, ...args: unknown[]) {
    console.log(chalk.cyan(format(message, ...args)));
  },
  success(message: string, ...args: unknown[]) {
    console.log(chalk.green(format(message, ...args)));
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(chalk.yellow(format(message, ...args)));
  },
  error(message: string, ...args: unknown[]) {
    console.error(chalk.red(format(message, ...args)));
  },
  debug(message: string, ...args: unknown[]) {
    debugLogger(format(message, ...args));
  },
  raw(message: string, ...args: unknown[]) {
    console.log(format(message, ...args));
  }
};
