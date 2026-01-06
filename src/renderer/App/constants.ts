// Animation config
export const panelTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

// Tab types
export type TabId = 'chat' | 'file' | 'terminal' | 'source-control';

// Tab metadata configuration
export interface TabConfig {
  id: TabId;
  icon: React.ElementType;
  labelKey: string;
}

// Default tab order
export const DEFAULT_TAB_ORDER: TabId[] = ['chat', 'file', 'terminal', 'source-control'];

// Repository type
export interface Repository {
  name: string;
  path: string;
}

// Panel size constraints
export const REPOSITORY_MIN = 200;
export const REPOSITORY_MAX = 400;
export const REPOSITORY_DEFAULT = 240;
export const WORKTREE_MIN = 200;
export const WORKTREE_MAX = 400;
export const WORKTREE_DEFAULT = 280;

// Tree layout constraints
export const TREE_SIDEBAR_MIN = 200;
export const TREE_SIDEBAR_DEFAULT = 280;
