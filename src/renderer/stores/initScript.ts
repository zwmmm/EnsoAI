import { create } from 'zustand';

interface PendingInitScript {
  worktreePath: string;
  script: string;
}

interface InitScriptState {
  pendingScript: PendingInitScript | null;
  setPendingScript: (script: PendingInitScript | null) => void;
  clearPendingScript: () => void;
}

export const useInitScriptStore = create<InitScriptState>((set) => ({
  pendingScript: null,
  setPendingScript: (pendingScript) => set({ pendingScript }),
  clearPendingScript: () => set({ pendingScript: null }),
}));
