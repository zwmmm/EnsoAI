import type { TabId } from './constants';

// Storage keys
export const STORAGE_KEYS = {
  REPOSITORIES: 'enso-repositories',
  SELECTED_REPO: 'enso-selected-repo',
  ACTIVE_WORKTREE: 'enso-active-worktree', // deprecated, kept for migration
  ACTIVE_WORKTREES: 'enso-active-worktrees', // per-repo worktree map
  WORKTREE_TABS: 'enso-worktree-tabs',
  WORKTREE_ORDER: 'enso-worktree-order', // per-repo worktree display order map
  REPOSITORY_WIDTH: 'enso-repository-width',
  WORKTREE_WIDTH: 'enso-worktree-width',
  TREE_SIDEBAR_WIDTH: 'enso-tree-sidebar-width',
  REPOSITORY_COLLAPSED: 'enso-repository-collapsed',
  WORKTREE_COLLAPSED: 'enso-worktree-collapsed',
  REPOSITORY_SETTINGS: 'enso-repository-settings', // per-repo settings (init script, etc.)
} as const;

// Helper to get initial value from localStorage
export const getStoredNumber = (key: string, defaultValue: number): number => {
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) : defaultValue;
};

export const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  const saved = localStorage.getItem(key);
  return saved !== null ? saved === 'true' : defaultValue;
};

export const getStoredTabMap = (): Record<string, TabId> => {
  const saved = localStorage.getItem(STORAGE_KEYS.WORKTREE_TABS);
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, TabId>;
    } catch {
      return {};
    }
  }
  return {};
};

// Per-repo worktree map: { [repoPath]: worktreePath }
export const getStoredWorktreeMap = (): Record<string, string> => {
  const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKTREES);
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
};

// Per-repo worktree order: { [repoPath]: { [worktreePath]: displayOrder } }
export const getStoredWorktreeOrderMap = (): Record<string, Record<string, number>> => {
  const saved = localStorage.getItem(STORAGE_KEYS.WORKTREE_ORDER);
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, Record<string, number>>;
    } catch {
      return {};
    }
  }
  return {};
};

export const saveWorktreeOrderMap = (orderMap: Record<string, Record<string, number>>): void => {
  localStorage.setItem(STORAGE_KEYS.WORKTREE_ORDER, JSON.stringify(orderMap));
};

// Get platform for path normalization
const getPlatform = (): string => {
  if (typeof navigator !== 'undefined') {
    const nav = navigator.platform;
    if (nav.startsWith('Win')) return 'win32';
    if (nav.startsWith('Mac')) return 'darwin';
  }
  return 'linux';
};

// Normalize path for comparison (handles case-insensitivity and trailing slashes)
export const normalizePath = (path: string): string => {
  // Remove trailing slashes/backslashes
  let normalized = path.replace(/[\\/]+$/, '');
  // On Windows and macOS, normalize to lowercase for case-insensitive comparison
  // Linux is case-sensitive, so we don't lowercase there
  const platform = getPlatform();
  if (platform === 'win32' || platform === 'darwin') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
};

// Check if two paths are equal (considering OS-specific rules)
export const pathsEqual = (path1: string, path2: string): boolean => {
  return normalizePath(path1) === normalizePath(path2);
};

// Repository settings types and helpers
export interface RepositorySettings {
  autoInitWorktree: boolean;
  initScript: string;
}

export const DEFAULT_REPOSITORY_SETTINGS: RepositorySettings = {
  autoInitWorktree: false,
  initScript: '',
};

export const getStoredRepositorySettings = (): Record<string, RepositorySettings> => {
  const saved = localStorage.getItem(STORAGE_KEYS.REPOSITORY_SETTINGS);
  if (saved) {
    try {
      return JSON.parse(saved) as Record<string, RepositorySettings>;
    } catch {
      return {};
    }
  }
  return {};
};

export const getRepositorySettings = (repoPath: string): RepositorySettings => {
  const allSettings = getStoredRepositorySettings();
  const normalizedPath = normalizePath(repoPath);
  return allSettings[normalizedPath] || DEFAULT_REPOSITORY_SETTINGS;
};

export const saveRepositorySettings = (repoPath: string, settings: RepositorySettings): void => {
  const allSettings = getStoredRepositorySettings();
  const normalizedPath = normalizePath(repoPath);
  allSettings[normalizedPath] = settings;
  localStorage.setItem(STORAGE_KEYS.REPOSITORY_SETTINGS, JSON.stringify(allSettings));
};
