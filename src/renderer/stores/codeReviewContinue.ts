import { create } from 'zustand';

interface CodeReviewContinueState {
  // Pending session to continue
  pendingSessionId: string | null;
  // Flag to switch to chat tab
  shouldSwitchToChat: boolean;

  // Request to continue a code review conversation
  requestContinue: (sessionId: string) => void;

  // Clear pending request (called after handling)
  clearRequest: () => void;

  // Clear tab switch flag (called after tab switched)
  clearTabSwitch: () => void;
}

export const useCodeReviewContinueStore = create<CodeReviewContinueState>((set) => ({
  pendingSessionId: null,
  shouldSwitchToChat: false,

  requestContinue: (sessionId) => set({ pendingSessionId: sessionId, shouldSwitchToChat: true }),

  clearRequest: () => set({ pendingSessionId: null }),

  clearTabSwitch: () => set({ shouldSwitchToChat: false }),
}));
