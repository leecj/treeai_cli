export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'sandboxBashMode'
  | 'strict';

export interface ToolPreset {
  executable: string;
  args?: string[];
}

export interface HistoryTask {
  name: string;
  branch: string;
  repo: string;
  worktreePath: string;
  lastUsed: string;
}

export interface TreeAIConfig {
  defaultRepo?: string;
  recentRepos: string[];
  defaultPermissionMode: PermissionMode;
  defaultAiTool?: string;
  toolPresets: Record<string, ToolPreset>;
  history: {
    tasks: HistoryTask[];
  };
  worktreeRoot?: string;
}

export const DEFAULT_CONFIG: TreeAIConfig = {
  recentRepos: [],
  defaultPermissionMode: 'bypassPermissions',
  defaultAiTool: 'claude',
  toolPresets: {
    claude: {
      executable: 'claude',
      args: ['--dangerously-skip-permissions']
    },
    codex: {
      executable: 'codexh',
      args: []
    },
    happy: {
      executable: 'happy',
      args: []
    }
  },
  history: {
    tasks: []
  }
};
