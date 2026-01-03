import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { normalizePath, pathsEqual } from '@/App/storage';
import type { Session } from '@/components/chat/SessionBar';
import type { AgentGroupState } from '@/components/chat/types';
import { createInitialGroupState } from '@/components/chat/types';

// Global storage key for all sessions across all repos
const SESSIONS_STORAGE_KEY = 'enso-agent-sessions';

// Check if an agent command supports session persistence
function isResumableAgent(agentCommand: string): boolean {
  return agentCommand?.startsWith('claude') ?? false;
}

// Group states indexed by normalized worktree path
type WorktreeGroupStates = Record<string, AgentGroupState>;

interface AgentSessionsState {
  sessions: Session[];
  activeIds: Record<string, string | null>; // key = cwd (worktree path)
  groupStates: WorktreeGroupStates; // Group states per worktree (not persisted)

  // Actions
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  setActiveId: (cwd: string, sessionId: string | null) => void;
  reorderSessions: (repoPath: string, cwd: string, fromIndex: number, toIndex: number) => void;
  getSessions: (repoPath: string, cwd: string) => Session[];
  getActiveSessionId: (repoPath: string, cwd: string) => string | null;

  // Group state actions
  getGroupState: (cwd: string) => AgentGroupState;
  setGroupState: (cwd: string, state: AgentGroupState) => void;
  updateGroupState: (cwd: string, updater: (state: AgentGroupState) => AgentGroupState) => void;
  removeGroupState: (cwd: string) => void;
}

function loadFromStorage(): { sessions: Session[]; activeIds: Record<string, string | null> } {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.sessions?.length > 0) {
        // Migrate old sessions that don't have repoPath (backwards compatibility)
        const migratedSessions = data.sessions.map((s: Session) => ({
          ...s,
          repoPath: s.repoPath || s.cwd,
        }));
        return { sessions: migratedSessions, activeIds: data.activeIds || {} };
      }
    }
  } catch {}
  return { sessions: [], activeIds: {} };
}

function saveToStorage(sessions: Session[], activeIds: Record<string, string | null>): void {
  // Only persist sessions that are:
  // 1. Using agents that support resumption (e.g., claude)
  // 2. Activated (user has pressed Enter at least once)
  const persistableSessions = sessions.filter(
    (s) => isResumableAgent(s.agentCommand) && s.activated
  );
  const persistableIds = new Set(persistableSessions.map((s) => s.id));
  // Only keep activeIds that reference persistable sessions
  const persistableActiveIds: Record<string, string | null> = {};
  for (const [cwd, id] of Object.entries(activeIds)) {
    persistableActiveIds[cwd] = id && persistableIds.has(id) ? id : null;
  }
  localStorage.setItem(
    SESSIONS_STORAGE_KEY,
    JSON.stringify({ sessions: persistableSessions, activeIds: persistableActiveIds })
  );
}

const initialState = loadFromStorage();

export const useAgentSessionsStore = create<AgentSessionsState>()(
  subscribeWithSelector((set, get) => ({
    sessions: initialState.sessions,
    activeIds: initialState.activeIds,
    groupStates: {}, // Not persisted - will be recreated from sessions on mount

    addSession: (session) =>
      set((state) => {
        // Calculate displayOrder: max order in same worktree + 1
        const worktreeSessions = state.sessions.filter(
          (s) => s.repoPath === session.repoPath && pathsEqual(s.cwd, session.cwd)
        );
        const maxOrder = worktreeSessions.reduce(
          (max, s) => Math.max(max, s.displayOrder ?? 0),
          -1
        );
        const newSession = { ...session, displayOrder: maxOrder + 1 };
        return {
          sessions: [...state.sessions, newSession],
          activeIds: { ...state.activeIds, [normalizePath(session.cwd)]: session.id },
        };
      }),

    removeSession: (id) =>
      set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== id);
        return { sessions: newSessions };
      }),

    updateSession: (id, updates) =>
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      })),

    setActiveId: (cwd, sessionId) =>
      set((state) => ({
        activeIds: { ...state.activeIds, [normalizePath(cwd)]: sessionId },
      })),

    reorderSessions: (repoPath, cwd, fromIndex, toIndex) =>
      set((state) => {
        // Get sessions for current worktree, sorted by displayOrder
        const worktreeSessions = state.sessions
          .filter((s) => s.repoPath === repoPath && pathsEqual(s.cwd, cwd))
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

        if (fromIndex < 0 || fromIndex >= worktreeSessions.length) return state;
        if (toIndex < 0 || toIndex >= worktreeSessions.length) return state;

        // Build new order array
        const orderedIds = worktreeSessions.map((s) => s.id);
        const [movedId] = orderedIds.splice(fromIndex, 1);
        orderedIds.splice(toIndex, 0, movedId);

        // Create id -> new displayOrder map
        const newOrderMap = new Map<string, number>();
        for (let i = 0; i < orderedIds.length; i++) {
          newOrderMap.set(orderedIds[i], i);
        }

        // Update displayOrder for affected sessions only (don't reorder array)
        return {
          sessions: state.sessions.map((s) => {
            if (s.repoPath === repoPath && pathsEqual(s.cwd, cwd)) {
              const newOrder = newOrderMap.get(s.id);
              if (newOrder !== undefined && newOrder !== s.displayOrder) {
                return { ...s, displayOrder: newOrder };
              }
            }
            return s;
          }),
        };
      }),

    getSessions: (repoPath, cwd) => {
      return get()
        .sessions.filter((s) => s.repoPath === repoPath && pathsEqual(s.cwd, cwd))
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    },

    getActiveSessionId: (repoPath, cwd) => {
      const state = get();
      const activeId = state.activeIds[normalizePath(cwd)];
      if (activeId) {
        // Verify the session exists and matches repoPath
        const session = state.sessions.find((s) => s.id === activeId);
        if (session && session.repoPath === repoPath) {
          return activeId;
        }
      }
      // Fallback to first session for this repo+cwd
      const firstSession = state.sessions.find(
        (s) => s.repoPath === repoPath && pathsEqual(s.cwd, cwd)
      );
      return firstSession?.id || null;
    },

    // Group state actions
    getGroupState: (cwd) => {
      const normalized = normalizePath(cwd);
      return get().groupStates[normalized] || createInitialGroupState();
    },

    setGroupState: (cwd, state) =>
      set((prev) => ({
        groupStates: { ...prev.groupStates, [normalizePath(cwd)]: state },
      })),

    updateGroupState: (cwd, updater) =>
      set((prev) => {
        const normalized = normalizePath(cwd);
        const currentState = prev.groupStates[normalized] || createInitialGroupState();
        return {
          groupStates: { ...prev.groupStates, [normalized]: updater(currentState) },
        };
      }),

    removeGroupState: (cwd) =>
      set((prev) => {
        const normalized = normalizePath(cwd);
        const newStates = { ...prev.groupStates };
        delete newStates[normalized];
        return { groupStates: newStates };
      }),
  }))
);

// Subscribe to state changes and persist to localStorage
useAgentSessionsStore.subscribe(
  (state) => ({ sessions: state.sessions, activeIds: state.activeIds }),
  ({ sessions, activeIds }) => {
    saveToStorage(sessions, activeIds);
  },
  { equalityFn: (a, b) => a.sessions === b.sessions && a.activeIds === b.activeIds }
);
