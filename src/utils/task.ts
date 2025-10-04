import path from 'node:path';
import { customAlphabet } from 'nanoid';

const randomId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

const INVALID_BRANCH_CHARS = /[\0-\x20~^:?*\[\]]+/g;

export const generateTaskId = (): string => `task-${randomId()}`;

const sanitizeSegment = (segment: string): string => {
  return segment
    .replace(INVALID_BRANCH_CHARS, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
};

export const normalizeTaskName = (input?: string): string => {
  if (!input || !input.trim()) {
    return generateTaskId();
  }

  const raw = input.trim();
  const segments = raw
    .split(/[\\/]+/)
    .map(sanitizeSegment)
    .filter(Boolean);

  if (!segments.length) {
    return generateTaskId();
  }

  return segments.join('/');
};

export const toBranchName = (taskName: string): string => {
  const normalized = normalizeTaskName(taskName);
  if (normalized.includes('/')) {
    return normalized;
  }
  return `feature/${normalized}`;
};

export const toWorktreeName = (branchName: string): string =>
  branchName.replace(/\//g, '-');

export const buildWorktreePath = (root: string, branchName: string): string => {
  return path.join(root, toWorktreeName(branchName));
};
