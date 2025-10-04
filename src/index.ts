#!/usr/bin/env node
import process from 'node:process';
import { createCLI } from './cli/index.js';
import { logger } from './utils/logger.js';

const run = async () => {
  const program = createCLI();
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error((error as Error).message);
    process.exitCode = 1;
  }
};

run();
