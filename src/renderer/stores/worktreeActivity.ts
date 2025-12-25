import { create } from 'zustand';

interface WorktreeActivity {
  agentCount: number;
  terminalCount: number;
}

type CloseHandler = (worktreePath: string) => void;

interface WorktreeActivityState {
  activities: Record<string, WorktreeActivity>;

  // Agent session tracking
  incrementAgent: (worktreePath: string) => void;
  decrementAgent: (worktreePath: string) => void;
  setAgentCount: (worktreePath: string, count: number) => void;

  // Terminal session tracking
  incrementTerminal: (worktreePath: string) => void;
  decrementTerminal: (worktreePath: string) => void;
  setTerminalCount: (worktreePath: string, count: number) => void;

  // Query helpers
  hasActivity: (worktreePath: string) => boolean;
  getActivity: (worktreePath: string) => WorktreeActivity;

  // Clean up
  clearWorktree: (worktreePath: string) => void;

  // Close handlers - panels register to receive close events
  agentCloseHandlers: Set<CloseHandler>;
  terminalCloseHandlers: Set<CloseHandler>;
  registerAgentCloseHandler: (handler: CloseHandler) => () => void;
  registerTerminalCloseHandler: (handler: CloseHandler) => () => void;
  closeAgentSessions: (worktreePath: string) => void;
  closeTerminalSessions: (worktreePath: string) => void;
}

const defaultActivity: WorktreeActivity = { agentCount: 0, terminalCount: 0 };

export const useWorktreeActivityStore = create<WorktreeActivityState>((set, get) => ({
  activities: {},

  incrementAgent: (worktreePath) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, agentCount: current.agentCount + 1 },
        },
      };
    }),

  decrementAgent: (worktreePath) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, agentCount: Math.max(0, current.agentCount - 1) },
        },
      };
    }),

  setAgentCount: (worktreePath, count) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, agentCount: count },
        },
      };
    }),

  incrementTerminal: (worktreePath) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, terminalCount: current.terminalCount + 1 },
        },
      };
    }),

  decrementTerminal: (worktreePath) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, terminalCount: Math.max(0, current.terminalCount - 1) },
        },
      };
    }),

  setTerminalCount: (worktreePath, count) =>
    set((state) => {
      const current = state.activities[worktreePath] || defaultActivity;
      return {
        activities: {
          ...state.activities,
          [worktreePath]: { ...current, terminalCount: count },
        },
      };
    }),

  hasActivity: (worktreePath) => {
    const activity = get().activities[worktreePath];
    return activity ? activity.agentCount > 0 || activity.terminalCount > 0 : false;
  },

  getActivity: (worktreePath) => {
    return get().activities[worktreePath] || defaultActivity;
  },

  clearWorktree: (worktreePath) =>
    set((state) => {
      const { [worktreePath]: _, ...rest } = state.activities;
      return { activities: rest };
    }),

  // Close handler registry
  agentCloseHandlers: new Set(),
  terminalCloseHandlers: new Set(),

  registerAgentCloseHandler: (handler) => {
    get().agentCloseHandlers.add(handler);
    return () => {
      get().agentCloseHandlers.delete(handler);
    };
  },

  registerTerminalCloseHandler: (handler) => {
    get().terminalCloseHandlers.add(handler);
    return () => {
      get().terminalCloseHandlers.delete(handler);
    };
  },

  closeAgentSessions: (worktreePath) => {
    for (const handler of get().agentCloseHandlers) {
      handler(worktreePath);
    }
  },

  closeTerminalSessions: (worktreePath) => {
    for (const handler of get().terminalCloseHandlers) {
      handler(worktreePath);
    }
  },
}));
