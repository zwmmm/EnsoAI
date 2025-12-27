export interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  isMainWorktree: boolean;
  isLocked: boolean;
  prunable: boolean;
}

export interface WorktreeCreateOptions {
  path: string;
  branch?: string;
  newBranch?: string;
  checkout?: boolean;
}

export interface WorktreeRemoveOptions {
  path: string;
  force?: boolean;
  deleteBranch?: boolean;
  branch?: string;
}

// Merge types
export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export interface WorktreeMergeOptions {
  worktreePath: string;
  targetBranch: string;
  strategy: MergeStrategy;
  noFf?: boolean; // default true for merge strategy
  message?: string;
  deleteWorktreeAfterMerge?: boolean;
  deleteBranchAfterMerge?: boolean;
}

export interface MergeConflict {
  file: string;
  type: 'content' | 'binary' | 'rename' | 'delete';
}

export interface MergeConflictContent {
  file: string;
  ours: string; // target branch content
  theirs: string; // worktree branch content
  base: string; // common ancestor content
}

export interface WorktreeMergeResult {
  success: boolean;
  merged: boolean;
  conflicts?: MergeConflict[];
  commitHash?: string;
  error?: string;
  warnings?: string[];
}

export interface ConflictResolution {
  file: string;
  content: string;
}

export interface MergeState {
  inProgress: boolean;
  targetBranch?: string;
  sourceBranch?: string;
  conflicts?: MergeConflict[];
}

export interface WorktreeMergeCleanupOptions {
  worktreePath?: string;
  sourceBranch?: string;
  deleteWorktreeAfterMerge?: boolean;
  deleteBranchAfterMerge?: boolean;
}
