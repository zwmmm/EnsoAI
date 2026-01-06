import { DEFAULT_TAB_ORDER, type TabId } from './constants';

// Storage keys
export const STORAGE_KEYS = {
  REPOSITORIES: 'enso-repositories',
  SELECTED_REPO: 'enso-selected-repo',
  ACTIVE_WORKTREE: 'enso-active-worktree', // deprecated, kept for migration
  ACTIVE_WORKTREES: 'enso-active-worktrees', // per-repo worktree map
  WORKTREE_TABS: 'enso-worktree-tabs',
  WORKTREE_ORDER: 'enso-worktree-order', // per-repo worktree display order map
  TAB_ORDER: 'enso-tab-order', // panel tab order
  REPOSITORY_WIDTH: 'enso-repository-width',
  WORKTREE_WIDTH: 'enso-worktree-width',
  TREE_SIDEBAR_WIDTH: 'enso-tree-sidebar-width',
  REPOSITORY_COLLAPSED: 'enso-repository-collapsed',
  WORKTREE_COLLAPSED: 'enso-worktree-collapsed',
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

// Panel tab order: array of TabId
const VALID_TAB_IDS = new Set<TabId>(DEFAULT_TAB_ORDER);

const normalizeTabOrder = (order: unknown): TabId[] => {
  if (!Array.isArray(order)) {
    return [...DEFAULT_TAB_ORDER];
  }

  const next: TabId[] = [];
  const seen = new Set<TabId>();

  for (const id of order) {
    if (typeof id === 'string' && VALID_TAB_IDS.has(id as TabId)) {
      const typedId = id as TabId;
      if (!seen.has(typedId)) {
        next.push(typedId);
        seen.add(typedId);
      }
    }
  }

  for (const id of DEFAULT_TAB_ORDER) {
    if (!seen.has(id)) {
      next.push(id);
    }
  }

  return next;
};

export const getStoredTabOrder = (): TabId[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.TAB_ORDER);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown;
      return normalizeTabOrder(parsed);
    } catch {
      // Return default order on error
    }
  }
  // Default order
  return [...DEFAULT_TAB_ORDER];
};

export const saveTabOrder = (order: TabId[]): void => {
  localStorage.setItem(STORAGE_KEYS.TAB_ORDER, JSON.stringify(normalizeTabOrder(order)));
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
